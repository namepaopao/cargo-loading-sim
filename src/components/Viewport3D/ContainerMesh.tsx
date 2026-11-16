import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { ContainerSpec } from '../../domain/types'

interface Props {
  spec: ContainerSpec
  overweight: boolean
  highlighted?: boolean
}

const CORNER = 0.12

/** Semi-transparent ISO shell: floor planks, door frame, corner castings, ribs. */
export function ContainerMesh({ spec, overweight, highlighted = false }: Props) {
  const { length: L, width: W, height: H, doorHeight: DH } = spec
  const edge = overweight ? '#c24b3a' : highlighted ? '#0a96a5' : '#3d5a72'
  const wall = overweight ? '#c48a82' : highlighted ? '#7eb0b8' : '#6a8498'
  const wallDeep = overweight ? '#b07870' : highlighted ? '#6a9aa2' : '#5a7388'
  const floor = overweight ? '#b89088' : '#8a9a7e'
  const metal = overweight ? '#c08078' : highlighted ? '#4a9aa5' : '#5a7488'
  const doorFrame = overweight ? '#c07068' : highlighted ? '#0d7a86' : '#4a6880'

  const edgesGeo = useMemo(() => {
    const box = new THREE.BoxGeometry(L, H, W)
    const edges = new THREE.EdgesGeometry(box)
    box.dispose()
    return edges
  }, [L, W, H])

  const floorPlanks = useMemo(() => {
    const count = Math.max(6, Math.round(L / 0.55))
    const plankW = L / count
    const geos: THREE.BufferGeometry[] = []
    for (let i = 0; i < count; i++) {
      const g = new THREE.BoxGeometry(plankW * 0.92, 0.012, W * 0.985)
      g.translate(-L / 2 + plankW * (i + 0.5), 0.006, 0)
      geos.push(g)
    }
    return geos
  }, [L, W])

  const sideRibs = useMemo(() => {
    const spacing = 0.42
    const count = Math.max(4, Math.floor(L / spacing))
    const items: { x: number }[] = []
    for (let i = 0; i < count; i++) {
      items.push({ x: -L / 2 + spacing * (i + 0.5) })
    }
    return items
  }, [L])

  useEffect(() => {
    return () => {
      edgesGeo.dispose()
      for (const g of floorPlanks) g.dispose()
    }
  }, [edgesGeo, floorPlanks])

  const castings = useMemo(() => {
    const xs = [-L / 2, L / 2]
    const ys = [0, H]
    const zs = [-W / 2, W / 2]
    const pts: [number, number, number][] = []
    for (const x of xs)
      for (const y of ys)
        for (const z of zs) pts.push([x, y, z])
    return pts
  }, [L, W, H])

  return (
    <group>
      {/* Floor plate */}
      <mesh position={[0, 0.002, 0]} receiveShadow>
        <boxGeometry args={[L, 0.004, W]} />
        <meshStandardMaterial
          color={floor}
          roughness={0.92}
          metalness={0.05}
          transparent
          opacity={0.85}
        />
      </mesh>

      {/* Wood-like planks */}
      {floorPlanks.map((geo, i) => (
        <mesh key={i} geometry={geo} receiveShadow>
          <meshStandardMaterial
            color={i % 2 === 0 ? '#4a5c45' : '#425440'}
            roughness={0.95}
            metalness={0.02}
            transparent
            opacity={0.9}
          />
        </mesh>
      ))}

      {/* Ceiling */}
      <mesh position={[0, H, 0]}>
        <boxGeometry args={[L, 0.02, W]} />
        <meshStandardMaterial
          color={wallDeep}
          roughness={0.8}
          metalness={0.15}
          transparent
          opacity={0.28}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Left / right walls */}
      <mesh position={[0, H / 2, -W / 2]}>
        <boxGeometry args={[L, H, 0.025]} />
        <meshStandardMaterial
          color={wall}
          roughness={0.75}
          metalness={0.2}
          transparent
          opacity={0.32}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, H / 2, W / 2]}>
        <boxGeometry args={[L, H, 0.025]} />
        <meshStandardMaterial
          color={wall}
          roughness={0.75}
          metalness={0.2}
          transparent
          opacity={0.32}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Corrugation ribs on long walls */}
      {sideRibs.map((r, i) => (
        <group key={i}>
          <mesh position={[r.x, H / 2, -W / 2 - 0.012]}>
            <boxGeometry args={[0.06, H * 0.96, 0.02]} />
            <meshStandardMaterial
              color={metal}
              roughness={0.55}
              metalness={0.35}
              transparent
              opacity={0.28}
              depthWrite={false}
            />
          </mesh>
          <mesh position={[r.x, H / 2, W / 2 + 0.012]}>
            <boxGeometry args={[0.06, H * 0.96, 0.02]} />
            <meshStandardMaterial
              color={metal}
              roughness={0.55}
              metalness={0.35}
              transparent
              opacity={0.28}
              depthWrite={false}
            />
          </mesh>
        </group>
      ))}

      {/* Rear wall */}
      <mesh position={[-L / 2, H / 2, 0]}>
        <boxGeometry args={[0.03, H, W]} />
        <meshStandardMaterial
          color={wallDeep}
          roughness={0.7}
          metalness={0.22}
          transparent
          opacity={0.4}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Door end frame (+X) — open mouth with lintel + posts */}
      <mesh position={[L / 2, DH + (H - DH) / 2, 0]}>
        <boxGeometry args={[0.06, H - DH, W]} />
        <meshStandardMaterial
          color={doorFrame}
          roughness={0.45}
          metalness={0.4}
          transparent
          opacity={0.55}
        />
      </mesh>
      <mesh position={[L / 2, DH / 2, -W / 2 + 0.04]}>
        <boxGeometry args={[0.06, DH, 0.08]} />
        <meshStandardMaterial
          color={doorFrame}
          roughness={0.45}
          metalness={0.4}
          transparent
          opacity={0.65}
        />
      </mesh>
      <mesh position={[L / 2, DH / 2, W / 2 - 0.04]}>
        <boxGeometry args={[0.06, DH, 0.08]} />
        <meshStandardMaterial
          color={doorFrame}
          roughness={0.45}
          metalness={0.4}
          transparent
          opacity={0.65}
        />
      </mesh>
      {/* Door sill */}
      <mesh position={[L / 2, 0.03, 0]}>
        <boxGeometry args={[0.08, 0.06, W]} />
        <meshStandardMaterial
          color={metal}
          roughness={0.5}
          metalness={0.45}
          transparent
          opacity={0.7}
        />
      </mesh>

      {/* ISO corner castings */}
      {castings.map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]}>
          <boxGeometry args={[CORNER, CORNER, CORNER]} />
          <meshStandardMaterial
            color={overweight ? '#d08078' : highlighted ? '#0d7a86' : '#6a8498'}
            roughness={0.35}
            metalness={0.55}
          />
        </mesh>
      ))}

      {/* Outer wireframe */}
      <lineSegments geometry={edgesGeo} position={[0, H / 2, 0]}>
        <lineBasicMaterial
          color={edge}
          transparent
          opacity={highlighted ? 1 : 0.9}
          linewidth={highlighted ? 2 : 1}
        />
      </lineSegments>

      {/* Soft ground pad under container */}
      <mesh position={[0, -0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[L + 0.8, W + 0.8]} />
        <meshBasicMaterial
          color={
            overweight ? '#e8c8c0' : highlighted ? '#b8dde2' : '#c8d4e0'
          }
          transparent
          opacity={highlighted ? 0.85 : 0.65}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}
