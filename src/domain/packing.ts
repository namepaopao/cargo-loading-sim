import { getUsableHeight } from './containerSpecs'
import type {
  CargoSelection,
  ContainerSpec,
  PackingResult,
  PalletInstance,
  PalletSku,
  Placement,
  UnplacedItem,
} from './types'
import { getSku } from './catalog'

const GAP = 0.02 // 20 mm clearance between pallets

interface FreeRect {
  x: number
  z: number
  length: number
  width: number
}

interface Oriented {
  length: number
  width: number
  rotated: boolean
}

function expandInstances(
  selections: CargoSelection[],
  catalog: PalletSku[],
): PalletInstance[] {
  const items: PalletInstance[] = []
  for (const sel of selections) {
    if (sel.quantity <= 0) continue
    const sku = catalog.find((s) => s.id === sel.skuId) ?? getSku(sel.skuId)
    if (!sku) continue
    for (let i = 0; i < sel.quantity; i++) {
      items.push({
        instanceId: `${sku.id}-${i + 1}`,
        skuId: sku.id,
        length: sku.length,
        width: sku.width,
        height: sku.height,
        weight: sku.weight,
        color: sku.color,
        canRotate: sku.canRotate,
        canStack: sku.canStack,
      })
    }
  }
  return items
}

function orientations(item: PalletInstance): Oriented[] {
  const opts: Oriented[] = [
    { length: item.length, width: item.width, rotated: false },
  ]
  if (item.canRotate && item.length !== item.width) {
    opts.push({ length: item.width, width: item.length, rotated: true })
  }
  return opts
}

/**
 * Lock one floor orientation per SKU for the whole container:
 * maximize how many fit across container width, then minimize leftover.
 * Avoids mixing “竖/横” for the same pallet type.
 */
function preferredFloorOrient(
  item: PalletInstance,
  containerWidth: number,
): Oriented {
  const opts = orientations(item)
  let best = opts[0]
  let bestCols = -1
  let bestWaste = Infinity

  for (const o of opts) {
    if (o.width > containerWidth + 1e-9) continue
    const pitch = o.width + GAP
    const cols = Math.max(1, Math.floor((containerWidth + GAP) / pitch))
    const used = cols * o.width + Math.max(0, cols - 1) * GAP
    const waste = containerWidth - used
    if (cols > bestCols || (cols === bestCols && waste < bestWaste - 1e-9)) {
      best = o
      bestCols = cols
      bestWaste = waste
    }
  }
  return best
}

function fits(rect: FreeRect, L: number, W: number): boolean {
  return L <= rect.length + 1e-9 && W <= rect.width + 1e-9
}

/** Guillotine-ish split of free rectangle after placing a box at bottom-left. */
function splitRect(
  rect: FreeRect,
  L: number,
  W: number,
): FreeRect[] {
  const result: FreeRect[] = []
  const rightW = rect.length - L - GAP
  const topH = rect.width - W - GAP

  if (rightW > 0.05) {
    result.push({
      x: rect.x + L + GAP,
      z: rect.z,
      length: rightW,
      width: W,
    })
  }
  if (topH > 0.05) {
    result.push({
      x: rect.x,
      z: rect.z + W + GAP,
      length: rect.length,
      width: topH,
    })
  }
  return result
}

function placeOnFloor(
  item: PalletInstance,
  free: FreeRect[],
  maxHeight: number,
  order: number,
  preferred: Oriented,
): { placement: Placement; free: FreeRect[] } | null {
  if (item.height > maxHeight + 1e-9) return null

  // Prefer locked orientation; only fall back if it cannot fit anywhere
  const orderedOrients = [
    preferred,
    ...orientations(item).filter(
      (o) => o.rotated !== preferred.rotated || o.length !== preferred.length,
    ),
  ]

  let best: {
    rectIndex: number
    orient: Oriented
    score: number
  } | null = null

  for (const orient of orderedOrients) {
    for (let i = 0; i < free.length; i++) {
      const rect = free[i]
      if (!fits(rect, orient.length, orient.width)) continue
      const waste =
        (rect.length - orient.length) * rect.width +
        orient.length * (rect.width - orient.width)
      // Strongly prefer the locked orientation so same SKU stays consistent
      const orientPenalty = orient.rotated === preferred.rotated ? 0 : 1000
      const score = orientPenalty + waste + rect.x * 0.01
      if (!best || score < best.score) {
        best = { rectIndex: i, orient, score }
      }
    }
    // If preferred orientation found any slot, stop — do not mix with fallback
    if (best && orient.rotated === preferred.rotated) break
  }

  if (!best) return null

  const rect = free[best.rectIndex]
  const { orient } = best
  const placement: Placement = {
    instanceId: item.instanceId,
    skuId: item.skuId,
    x: rect.x,
    y: 0,
    z: rect.z,
    length: orient.length,
    width: orient.width,
    height: item.height,
    weight: item.weight,
    color: item.color,
    rotated: orient.rotated,
    order,
  }

  const nextFree = [
    ...free.slice(0, best.rectIndex),
    ...free.slice(best.rectIndex + 1),
    ...splitRect(rect, orient.length, orient.width),
  ]

  return { placement, free: nextFree }
}

function hasLoadOnTop(base: Placement, placements: Placement[]): boolean {
  const top = base.y + base.height
  return placements.some(
    (p) =>
      p.instanceId !== base.instanceId &&
      p.y + 1e-9 >= top &&
      p.x < base.x + base.length - 1e-9 &&
      p.x + p.length > base.x + 1e-9 &&
      p.z < base.z + base.width - 1e-9 &&
      p.z + p.width > base.z + 1e-9,
  )
}

function tryStack(
  item: PalletInstance,
  bases: Placement[],
  maxHeight: number,
  order: number,
  preferred: Oriented,
): Placement | null {
  if (!item.canStack) return null
  if (item.height > maxHeight + 1e-9) return null

  // Floor-layer bases that can accept one more tier, no cargo already on top
  const candidates = bases
    .filter((b) => {
      if (b.y > 1e-9) return false // only stack onto floor layer (2-high max)
      const sku = getSku(b.skuId)
      if (sku && !sku.canStack) return false
      if (hasLoadOnTop(b, bases)) return false
      const topY = b.y + b.height
      if (topY + item.height > maxHeight + 1e-9) return false
      return true
    })
    .sort((a, b) => a.x - b.x || a.z - b.z)

  const orderedOrients = [
    preferred,
    ...orientations(item).filter(
      (o) => o.rotated !== preferred.rotated || o.length !== preferred.length,
    ),
  ]

  for (const base of candidates) {
    for (const orient of orderedOrients) {
      if (orient.length <= base.length + 1e-9 && orient.width <= base.width + 1e-9) {
        return {
          instanceId: item.instanceId,
          skuId: item.skuId,
          x: base.x,
          y: base.y + base.height,
          z: base.z,
          length: orient.length,
          width: orient.width,
          height: item.height,
          weight: item.weight,
          color: item.color,
          rotated: orient.rotated,
          order,
        }
      }
    }
  }
  return null
}

/**
 * Floor free-rect packing with optional second-layer stacking.
 * Items sorted by base area (desc) then weight (desc).
 */
export function packPallets(
  selections: CargoSelection[],
  container: ContainerSpec,
  payloadLimit: number,
  catalog: PalletSku[] = [],
): PackingResult {
  const items = expandInstances(selections, catalog)
  items.sort((a, b) => {
    const areaDiff = b.length * b.width - a.length * a.width
    if (Math.abs(areaDiff) > 1e-9) return areaDiff
    return b.weight - a.weight
  })

  const maxHeight = getUsableHeight(container)
  const containerVolume = container.length * container.width * container.height

  // One stable floor orientation per SKU for this container
  const orientBySku = new Map<string, Oriented>()
  for (const item of items) {
    if (!orientBySku.has(item.skuId)) {
      orientBySku.set(
        item.skuId,
        preferredFloorOrient(item, container.width),
      )
    }
  }

  let free: FreeRect[] = [
    {
      x: 0,
      z: 0,
      length: container.length,
      width: container.width,
    },
  ]

  const placements: Placement[] = []
  const unplaced: UnplacedItem[] = []
  let totalWeight = 0
  let order = 0

  for (const item of items) {
    if (item.height > maxHeight + 1e-9) {
      unplaced.push({
        instanceId: item.instanceId,
        skuId: item.skuId,
        reason: 'overheight',
      })
      continue
    }

    if (totalWeight + item.weight > payloadLimit + 1e-6) {
      unplaced.push({
        instanceId: item.instanceId,
        skuId: item.skuId,
        reason: 'overweight',
      })
      continue
    }

    const preferred =
      orientBySku.get(item.skuId) ?? preferredFloorOrient(item, container.width)

    // Stack onto an existing floor pallet first (when allowed / height fits),
    // so 2-high columns appear even before the floor is full.
    const stacked = tryStack(item, placements, maxHeight, order, preferred)
    if (stacked) {
      placements.push(stacked)
      totalWeight += item.weight
      order += 1
      continue
    }

    const floor = placeOnFloor(item, free, maxHeight, order, preferred)
    if (floor) {
      free = floor.free
      placements.push(floor.placement)
      totalWeight += item.weight
      order += 1
      continue
    }

    unplaced.push({
      instanceId: item.instanceId,
      skuId: item.skuId,
      reason: 'no_space',
    })
  }

  const totalVolume = placements.reduce(
    (sum, p) => sum + p.length * p.width * p.height,
    0,
  )
  const maxStackHeight = placements.reduce(
    (m, p) => Math.max(m, p.y + p.height),
    0,
  )

  return {
    placements,
    unplaced,
    totalWeight,
    totalVolume,
    payloadLimit,
    containerVolume,
    overweight:
      totalWeight > payloadLimit ||
      unplaced.some((u) => u.reason === 'overweight'),
    maxStackHeight,
  }
}
