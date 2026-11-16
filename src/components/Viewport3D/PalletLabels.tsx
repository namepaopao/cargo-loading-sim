import { Text } from '@react-three/drei'
import type { ContainerSpec, Placement } from '../../domain/types'

interface Props {
  placements: Placement[]
  container: ContainerSpec
  /** Only show labels for boxes that have mostly settled */
  visibleCount: number
}

function dimLabel(p: Placement): string {
  const l = Math.round(p.length * 1000)
  const w = Math.round(p.width * 1000)
  const h = Math.round(p.height * 1000)
  return `${l}×${w}×${h}`
}

/** Dimension stamps on each placed pallet — size via numbers, not color alone. */
export function PalletLabels({ placements, container, visibleCount }: Props) {
  const ox = -container.length / 2
  const oz = -container.width / 2
  const n = Math.min(visibleCount, placements.length)

  return (
    <group>
      {placements.slice(0, n).map((p) => {
        const cx = ox + p.x + p.length / 2
        const cy = p.y + p.height / 2
        const cz = oz + p.z + p.width / 2
        const label = dimLabel(p)
        const topSize = Math.min(p.length, p.width) * 0.1
        const sideSize = Math.min(p.width, p.height) * 0.09

        return (
          <group key={p.instanceId}>
            <Text
              position={[cx, p.y + p.height + 0.01, cz]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={topSize}
              color="#1a222c"
              outlineWidth={topSize * 0.1}
              outlineColor="#f7f1e6"
              anchorX="center"
              anchorY="middle"
              maxWidth={p.length * 0.9}
              overflowWrap="normal"
              textAlign="center"
              depthOffset={-1}
              fillOpacity={0.92}
            >
              {label}
            </Text>
            <Text
              position={[ox + p.x + p.length + 0.008, cy, cz]}
              rotation={[0, Math.PI / 2, 0]}
              fontSize={sideSize}
              color="#1a222c"
              outlineWidth={sideSize * 0.1}
              outlineColor="#f7f1e6"
              anchorX="center"
              anchorY="middle"
              maxWidth={p.width * 0.9}
              overflowWrap="normal"
              textAlign="center"
              depthOffset={-1}
              fillOpacity={0.88}
            >
              {label}
            </Text>
          </group>
        )
      })}
    </group>
  )
}
