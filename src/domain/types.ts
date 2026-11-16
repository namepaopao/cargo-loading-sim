export type ContainerType = '20GP' | '40GP'
export type TransportMode = 'sea' | 'rail'

export interface ContainerSpec {
  type: ContainerType
  label: string
  /** Internal length (m) — along door→rear axis */
  length: number
  /** Internal width (m) */
  width: number
  /** Internal height (m) */
  height: number
  /** Door opening height (m) */
  doorHeight: number
  /** Tare weight (kg) */
  tare: number
  /** Structural max payload (kg) — MGW − tare */
  structuralPayload: number
}

export interface PalletSku {
  id: string
  name: string
  /** Length (m) */
  length: number
  /** Width (m) */
  width: number
  /** Total height including pallet base (m) */
  height: number
  /** Gross weight per pallet (kg) */
  weight: number
  /** Display color (hex) */
  color: string
  /** Allow 90° floor rotation */
  canRotate: boolean
  /** Allow stacking another pallet on top */
  canStack: boolean
  description: string
}

export interface PalletInstance {
  instanceId: string
  skuId: string
  length: number
  width: number
  height: number
  weight: number
  color: string
  canRotate: boolean
  canStack: boolean
}

export interface Placement {
  instanceId: string
  skuId: string
  /** Bottom-left-rear corner in container coords (m): x along length, y up, z across width */
  x: number
  y: number
  z: number
  length: number
  width: number
  height: number
  weight: number
  color: string
  /** True if length/width swapped vs SKU default */
  rotated: boolean
  order: number
}

export type UnplacedReason = 'no_space' | 'overweight' | 'overheight'

export interface UnplacedItem {
  instanceId: string
  skuId: string
  reason: UnplacedReason
}

export interface PackingResult {
  placements: Placement[]
  unplaced: UnplacedItem[]
  totalWeight: number
  totalVolume: number
  payloadLimit: number
  containerVolume: number
  overweight: boolean
  maxStackHeight: number
}

export interface CargoSelection {
  skuId: string
  quantity: number
}

/** One physical container slot in the scene (kept when adding more). */
export interface ContainerJob {
  id: string
  type: ContainerType
  transportMode: TransportMode
  result: PackingResult | null
  visibleCount: number
  animating: boolean
}
