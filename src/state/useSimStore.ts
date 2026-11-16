import { create } from 'zustand'
import { PALLET_CATALOG } from '../domain/catalog'
import {
  CONTAINER_SPECS,
  getPayloadLimit,
} from '../domain/containerSpecs'
import { packPallets } from '../domain/packing'
import type {
  CargoSelection,
  ContainerJob,
  ContainerType,
  TransportMode,
  UnplacedItem,
} from '../domain/types'

export const MAX_AUTO_CONTAINERS = 40

/** Rebuild quantity selections from items that still need a container. */
function selectionsFromUnplaced(unplaced: UnplacedItem[]): CargoSelection[] {
  const counts = new Map<string, number>()
  for (const u of unplaced) {
    counts.set(u.skuId, (counts.get(u.skuId) ?? 0) + 1)
  }
  return [...counts.entries()].map(([skuId, quantity]) => ({ skuId, quantity }))
}

export type AnimSpeed = 1 | 2 | 4

let jobSeq = 1
function createJob(
  type: ContainerType,
  transportMode: TransportMode,
): ContainerJob {
  return {
    id: `job-${jobSeq++}`,
    type,
    transportMode,
    result: null,
    visibleCount: 0,
    animating: false,
  }
}

interface SimState {
  jobs: ContainerJob[]
  activeJobId: string
  selections: CargoSelection[]
  allowStack: boolean
  lowPower: boolean
  animSpeed: AnimSpeed
  selectedSkuId: string | null

  activeJob: () => ContainerJob
  addContainer: (type: ContainerType) => void
  selectJob: (id: string) => void
  removeJob: (id: string) => void
  setActiveTransportMode: (m: TransportMode) => void
  setQuantity: (skuId: string, quantity: number) => void
  setAllowStack: (v: boolean) => void
  setLowPower: (v: boolean) => void
  setAnimSpeed: (s: AnimSpeed) => void
  setSelectedSkuId: (id: string | null) => void
  runPacking: () => void
  skipAnimation: () => void
  setJobVisibleCount: (jobId: string, n: number) => void
  setJobAnimating: (jobId: string, v: boolean) => void
  reset: () => void
}

const defaultSelections: CargoSelection[] = PALLET_CATALOG.map((sku) => ({
  skuId: sku.id,
  quantity: sku.id === 'iso-1200x1000' ? 6 : sku.id === 'iso-1200x800' ? 4 : 0,
}))

function detectLowPowerDefault(): boolean {
  if (typeof navigator === 'undefined') return false
  const cores = navigator.hardwareConcurrency ?? 4
  return cores <= 4
}

const initialJob = createJob('20GP', 'sea')

export const useSimStore = create<SimState>((set, get) => ({
  jobs: [initialJob],
  activeJobId: initialJob.id,
  selections: defaultSelections,
  allowStack: true,
  lowPower: detectLowPowerDefault(),
  animSpeed: 1,
  selectedSkuId: 'iso-1200x1000',

  activeJob: () => {
    const { jobs, activeJobId } = get()
    return jobs.find((j) => j.id === activeJobId) ?? jobs[0]
  },

  addContainer: (type) => {
    const mode = get().activeJob().transportMode
    const job = createJob(type, mode)
    set((s) => {
      // Keep same-size cabinets together: 20GP cluster, then 40GP cluster
      const typeOrder = { '20GP': 0, '40GP': 1 } as const
      const jobs = [...s.jobs, job].sort(
        (a, b) => typeOrder[a.type] - typeOrder[b.type],
      )
      return { jobs, activeJobId: job.id }
    })
  },

  selectJob: (id) => {
    const exists = get().jobs.some((j) => j.id === id)
    if (exists) set({ activeJobId: id })
  },

  removeJob: (id) => {
    const { jobs, activeJobId } = get()
    if (jobs.length <= 1) return
    const next = jobs.filter((j) => j.id !== id)
    set({
      jobs: next,
      activeJobId: activeJobId === id ? next[next.length - 1].id : activeJobId,
    })
  },

  setActiveTransportMode: (m) =>
    set((s) => ({
      jobs: s.jobs.map((j) =>
        j.id === s.activeJobId ? { ...j, transportMode: m } : j,
      ),
    })),

  setQuantity: (skuId, quantity) =>
    set((s) => ({
      selections: s.selections.map((sel) =>
        sel.skuId === skuId
          ? { ...sel, quantity: Math.max(0, Math.min(40, Math.floor(quantity))) }
          : sel,
      ),
    })),

  setAllowStack: (v) => set({ allowStack: v }),
  setLowPower: (v) => set({ lowPower: v }),
  setAnimSpeed: (s) => set({ animSpeed: s }),
  setSelectedSkuId: (id) => set({ selectedSkuId: id }),

  runPacking: () => {
    const { activeJobId, selections, allowStack, jobs } = get()
    const seed = jobs.find((j) => j.id === activeJobId)
    if (!seed) return

    const { type, transportMode } = seed
    const spec = CONTAINER_SPECS[type]
    const limit = getPayloadLimit(type, transportMode)
    const catalog = PALLET_CATALOG.map((sku) => ({
      ...sku,
      canStack: allowStack ? sku.canStack : false,
    }))

    let remaining: CargoSelection[] = selections
      .filter((s) => s.quantity > 0)
      .map((s) => ({ ...s }))

    const newJobs: ContainerJob[] = []

    while (
      remaining.some((s) => s.quantity > 0) &&
      newJobs.length < MAX_AUTO_CONTAINERS
    ) {
      const result = packPallets(remaining, spec, limit, catalog)

      // Nothing fit in a fresh container — stop (avoid empty spillover loop)
      if (result.placements.length === 0) {
        if (newJobs.length === 0) {
          newJobs.push({
            ...createJob(type, transportMode),
            result,
            visibleCount: 0,
            animating: false,
          })
        } else {
          const last = newJobs[newJobs.length - 1]
          if (last.result) {
            newJobs[newJobs.length - 1] = {
              ...last,
              result: {
                ...last.result,
                unplaced: [...last.result.unplaced, ...result.unplaced],
              },
            }
          }
        }
        break
      }

      // overheight never fits a same-size next box; no_space / overweight can
      const spill = result.unplaced.filter((u) => u.reason !== 'overheight')
      const stuck = result.unplaced.filter((u) => u.reason === 'overheight')
      const hasSpill = spill.length > 0

      newJobs.push({
        ...createJob(type, transportMode),
        result: {
          ...result,
          // Spill moves to the next container; only show leftovers when done
          unplaced: hasSpill ? stuck : result.unplaced,
        },
        visibleCount: 0,
        animating: false,
      })

      if (!hasSpill) break
      remaining = selectionsFromUnplaced(spill)
    }

    if (newJobs.length === 0) return

    // Fill one container completely (animated) before starting the next
    for (let i = 0; i < newJobs.length; i++) {
      const n = newJobs[i].result?.placements.length ?? 0
      newJobs[i] = {
        ...newJobs[i],
        visibleCount: 0,
        animating: i === 0 && n > 0,
      }
    }

    set({
      jobs: newJobs,
      activeJobId: newJobs[0].id,
    })
  },

  skipAnimation: () => {
    set((s) => ({
      jobs: s.jobs.map((j) => {
        if (!j.result) return j
        const n = j.result.placements.length
        if (!j.animating && j.visibleCount >= n) return j
        return {
          ...j,
          visibleCount: n,
          animating: false,
        }
      }),
    }))
  },

  setJobVisibleCount: (jobId, n) =>
    set((s) => ({
      jobs: s.jobs.map((j) =>
        j.id === jobId ? { ...j, visibleCount: n } : j,
      ),
    })),

  setJobAnimating: (jobId, v) =>
    set((s) => {
      let jobs = s.jobs.map((j) =>
        j.id === jobId ? { ...j, animating: v } : j,
      )
      let activeJobId = s.activeJobId

      // After a container finishes, start loading the next one
      if (!v) {
        const idx = jobs.findIndex((j) => j.id === jobId)
        for (let i = idx + 1; i < jobs.length; i++) {
          const next = jobs[i]
          const n = next.result?.placements.length ?? 0
          if (n > 0 && next.visibleCount < n && !next.animating) {
            jobs = jobs.map((j, ji) =>
              ji === i
                ? { ...j, animating: true, visibleCount: 0 }
                : j,
            )
            activeJobId = next.id
            break
          }
        }
      }

      return { jobs, activeJobId }
    }),

  reset: () => {
    const job = createJob('20GP', 'sea')
    set({
      jobs: [job],
      activeJobId: job.id,
      selections: PALLET_CATALOG.map((sku) => ({ skuId: sku.id, quantity: 0 })),
      selectedSkuId: null,
    })
  },
}))
