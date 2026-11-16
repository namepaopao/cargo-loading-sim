import { PALLET_CATALOG, getSku } from '../../domain/catalog'
import {
  CONTAINER_SPECS,
  TRANSPORT_LABELS,
  getPayloadLimit,
} from '../../domain/containerSpecs'
import type { ContainerType, TransportMode } from '../../domain/types'
import { useSimStore, type AnimSpeed } from '../../state/useSimStore'
import styles from './LeftPanel.module.css'

const REASON_LABEL = {
  no_space: '空间不足',
  overweight: '超限重',
  overheight: '超高',
} as const

export function LeftPanel() {
  const jobs = useSimStore((s) => s.jobs)
  const activeJobId = useSimStore((s) => s.activeJobId)
  const selections = useSimStore((s) => s.selections)
  const allowStack = useSimStore((s) => s.allowStack)
  const lowPower = useSimStore((s) => s.lowPower)
  const animSpeed = useSimStore((s) => s.animSpeed)
  const selectedSkuId = useSimStore((s) => s.selectedSkuId)
  const addContainer = useSimStore((s) => s.addContainer)
  const selectJob = useSimStore((s) => s.selectJob)
  const removeJob = useSimStore((s) => s.removeJob)
  const setActiveTransportMode = useSimStore((s) => s.setActiveTransportMode)
  const setQuantity = useSimStore((s) => s.setQuantity)
  const setAllowStack = useSimStore((s) => s.setAllowStack)
  const setLowPower = useSimStore((s) => s.setLowPower)
  const setAnimSpeed = useSimStore((s) => s.setAnimSpeed)
  const setSelectedSkuId = useSimStore((s) => s.setSelectedSkuId)
  const runPacking = useSimStore((s) => s.runPacking)
  const skipAnimation = useSimStore((s) => s.skipAnimation)
  const reset = useSimStore((s) => s.reset)

  const active = jobs.find((j) => j.id === activeJobId) ?? jobs[0]
  const spec = CONTAINER_SPECS[active.type]
  const limit = getPayloadLimit(active.type, active.transportMode)
  const result = active.result
  const totalSelected = selections.reduce((n, s) => n + s.quantity, 0)
  const selectedSku = selectedSkuId ? getSku(selectedSkuId) : undefined
  const fleetPacked = jobs.reduce(
    (n, j) => n + (j.result?.placements.length ?? 0),
    0,
  )
  const fleetUnplaced = jobs.reduce(
    (n, j) => n + (j.result?.unplaced.length ?? 0),
    0,
  )
  const fleetVolume = jobs.reduce(
    (n, j) => n + (j.result?.totalVolume ?? 0),
    0,
  )
  const fleetContainerVolume = jobs.reduce(
    (n, j) => n + (j.result?.containerVolume ?? 0),
    0,
  )
  const fleetUtilPct =
    fleetContainerVolume > 0
      ? (fleetVolume / fleetContainerVolume) * 100
      : 0
  const anyAnimating = jobs.some(
    (j) =>
      j.animating ||
      (j.result != null && j.visibleCount < j.result.placements.length),
  )

  return (
    <aside className={styles.panel}>
      <section className={styles.section}>
        <div className={styles.sectionTitle}>集装箱列表</div>
        <div className={styles.jobPills}>
          {jobs.map((job, index) => {
            const packed = job.result?.placements.length ?? 0
            const isActive = job.id === activeJobId
            const label = job.type === '20GP' ? "20'" : "40'"
            const tip = [
              CONTAINER_SPECS[job.type].label,
              TRANSPORT_LABELS[job.transportMode],
              job.result
                ? `已装 ${packed} 托${job.result.overweight ? ' · 超重' : ''}`
                : '未装箱',
            ].join(' · ')
            return (
              <div
                key={job.id}
                className={`${styles.jobPill} ${isActive ? styles.jobPillActive : ''} ${job.result?.overweight ? styles.jobPillWarn : ''}`}
                title={tip}
              >
                <button
                  type="button"
                  className={styles.jobPillSelect}
                  onClick={() => selectJob(job.id)}
                >
                  <span className={styles.jobPillIndex}>#{index + 1}</span>
                  <span className={styles.jobPillType}>{label}</span>
                  {job.result && (
                    <span className={styles.jobPillCount}>{packed}</span>
                  )}
                </button>
                {jobs.length > 1 && (
                  <button
                    type="button"
                    className={styles.jobPillRemove}
                    title="删除此柜"
                    aria-label={`删除柜 #${index + 1}`}
                    onClick={() => removeJob(job.id)}
                  >
                    ×
                  </button>
                )}
              </div>
            )
          })}
        </div>
        <div className={styles.row}>
          {(['20GP', '40GP'] as ContainerType[]).map((t) => (
            <button
              key={t}
              type="button"
              className={styles.chip}
              onClick={() => addContainer(t)}
            >
              + 添加 {t}
            </button>
          ))}
        </div>
        <div className={styles.hint}>
          当前柜内尺寸 {spec.length.toFixed(2)} × {spec.width.toFixed(2)} ×{' '}
          {spec.height.toFixed(2)} m · 门高 {spec.doorHeight.toFixed(2)} m
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionTitle}>当前柜运输方式（ISO 限重）</div>
        <div className={styles.row}>
          {(['sea', 'rail'] as TransportMode[]).map((m) => (
            <button
              key={m}
              type="button"
              className={`${styles.chip} ${active.transportMode === m ? styles.chipActive : ''}`}
              onClick={() => setActiveTransportMode(m)}
            >
              {TRANSPORT_LABELS[m]}
            </button>
          ))}
        </div>
        <div className={styles.hint}>
          ISO 668 可装货重上限 <strong>{limit.toLocaleString()} kg</strong>
          （海运 / 铁路共用国际标准柜）
        </div>
      </section>

      <section className={`${styles.section} ${styles.sectionGrow}`}>
        <div className={styles.sectionTitle}>
          托盘货（ISO 6780）→ 按当前柜型装箱
        </div>
        <div className={styles.cargoList}>
          {PALLET_CATALOG.map((sku) => {
            const sel = selections.find((s) => s.skuId === sku.id)
            const qty = sel?.quantity ?? 0
            const isSelected = selectedSkuId === sku.id
            return (
              <button
                key={sku.id}
                type="button"
                className={`${styles.cargoItem} ${isSelected ? styles.cargoItemActive : ''}`}
                onClick={() => setSelectedSkuId(sku.id)}
              >
                <span
                  className={styles.swatch}
                  style={{ background: sku.color }}
                />
                <span className={styles.cargoMeta}>
                  <span className={styles.cargoName}>{sku.name}</span>
                  <span className={styles.cargoDims}>
                    {(sku.length * 1000).toFixed(0)}×{(sku.width * 1000).toFixed(0)}×
                    {(sku.height * 1000).toFixed(0)} mm · {sku.weight} kg
                  </span>
                </span>
                <span
                  className={styles.qtyControl}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    aria-label="减少"
                    onClick={() => setQuantity(sku.id, qty - 1)}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={0}
                    max={40}
                    value={qty}
                    onChange={(e) =>
                      setQuantity(sku.id, Number(e.target.value) || 0)
                    }
                  />
                  <button
                    type="button"
                    aria-label="增加"
                    onClick={() => setQuantity(sku.id, qty + 5)}
                  >
                    +
                  </button>
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {selectedSku && (
        <section className={styles.detail}>
          <strong>{selectedSku.name}</strong>
          <div>{selectedSku.description}</div>
          <div>
            可旋转：{selectedSku.canRotate ? '是' : '否'} · 默认可叠放：
            {selectedSku.canStack ? '是' : '否'}
          </div>
        </section>
      )}

      <section className={styles.section}>
        <div className={styles.sectionTitle}>选项</div>
        <div className={styles.toggles}>
          <label>
            <input
              type="checkbox"
              checked={allowStack}
              onChange={(e) => setAllowStack(e.target.checked)}
            />
            允许叠放（若 SKU 支持）
          </label>
          <label>
            <input
              type="checkbox"
              checked={lowPower}
              onChange={(e) => setLowPower(e.target.checked)}
            />
            低配模式（降分辨率 / 加快动画）
          </label>
          <label>
            动画速度
            <select
              value={animSpeed}
              onChange={(e) =>
                setAnimSpeed(Number(e.target.value) as AnimSpeed)
              }
            >
              <option value={1}>1×</option>
              <option value={2}>2×</option>
              <option value={4}>4×</option>
            </select>
          </label>
        </div>
      </section>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primary}
          disabled={totalSelected === 0}
          onClick={runPacking}
        >
          开始装箱
        </button>
        {anyAnimating && (
          <button type="button" className={styles.secondary} onClick={skipAnimation}>
            跳过动画
          </button>
        )}
        <button type="button" className={styles.secondary} onClick={reset}>
          全部重置
        </button>
      </div>
      <div className={styles.hint}>
        以当前柜型 / 限重装箱；装满一柜后再装下一柜，装不下自动续开同型柜（最多 40 柜）
      </div>

      {result && (
        <section className={styles.stats}>
          <div className={styles.sectionTitle}>
            装箱结果 · 共 {jobs.length} 柜
          </div>
          <div className={styles.statRow}>
            <span>全部已装 / 未装</span>
            <span>
              {fleetPacked} / {fleetUnplaced}
            </span>
          </div>
          <div className={styles.statRow}>
            <span>整体利用率</span>
            <span>{fleetUtilPct.toFixed(1)}%</span>
          </div>
          <div className={styles.statRow}>
            <span>当前柜 · {CONTAINER_SPECS[active.type].label}</span>
            <span>{result.placements.length} 托</span>
          </div>
          <div className={styles.statRow}>
            <span>当前柜重量</span>
            <span className={result.overweight ? styles.statWarn : styles.statOk}>
              {Math.round(result.totalWeight).toLocaleString()} /{' '}
              {result.payloadLimit.toLocaleString()} kg
              {result.overweight ? ' · 超重' : ''}
            </span>
          </div>
          <div className={styles.statRow}>
            <span>当前柜体积利用率</span>
            <span>
              {((result.totalVolume / result.containerVolume) * 100).toFixed(1)}%
            </span>
          </div>
          <div className={styles.statRow}>
            <span>当前柜最高堆码</span>
            <span>
              {result.maxStackHeight.toFixed(2)} / {spec.doorHeight.toFixed(2)} m
              （门高）
            </span>
          </div>
          {fleetUnplaced > 0 && (
            <ul className={styles.unplaced}>
              {summarizeUnplaced(
                jobs.flatMap((j) => j.result?.unplaced ?? []),
              ).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
        </section>
      )}
    </aside>
  )
}

function summarizeUnplaced(
  items: { skuId: string; reason: keyof typeof REASON_LABEL }[],
): string[] {
  const map = new Map<string, number>()
  for (const u of items) {
    const sku = getSku(u.skuId)
    const key = `${sku?.name ?? u.skuId} · ${REASON_LABEL[u.reason]}`
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return [...map.entries()].map(([k, n]) => `未装入 ${n} 托：${k}`)
}
