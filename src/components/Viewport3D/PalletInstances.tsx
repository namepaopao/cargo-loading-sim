import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { ContainerSpec, Placement } from '../../domain/types'
import { useSimStore } from '../../state/useSimStore'

interface Props {
  jobId: string
  placements: Placement[]
  container: ContainerSpec
  animating: boolean
  visibleCount: number
}

const _obj = new THREE.Object3D()
const _color = new THREE.Color()

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

function clamp01(t: number): number {
  return Math.min(1, Math.max(0, t))
}

/**
 * Unit pallet: thin wood base + cargo block on top.
 * Built with bottom at y=0 / top at y=1, then recentered to origin for scaling.
 */
function createPalletGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []

  const base = new THREE.BoxGeometry(1.02, 0.09, 1.02)
  base.translate(0, 0.045, 0)
  parts.push(base)

  const cargo = new THREE.BoxGeometry(0.96, 0.91, 0.96)
  cargo.translate(0, 0.09 + 0.455, 0)
  parts.push(cargo)

  for (let i = -1; i <= 1; i++) {
    const plank = new THREE.BoxGeometry(1.04, 0.018, 0.2)
    plank.translate(0, 0.1, i * 0.34)
    parts.push(plank)
  }

  const merged = mergeGeometries(parts)
  for (const p of parts) p.dispose()
  return merged
}

function mergeGeometries(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  let indexOffset = 0
  const indices: number[] = []

  for (const geo of geos) {
    const pos = geo.getAttribute('position')
    const nor = geo.getAttribute('normal')
    const uv = geo.getAttribute('uv')
    const idx = geo.getIndex()

    for (let i = 0; i < pos.count; i++) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i))
      if (nor) normals.push(nor.getX(i), nor.getY(i), nor.getZ(i))
      if (uv) uvs.push(uv.getX(i), uv.getY(i))
    }

    if (idx) {
      for (let i = 0; i < idx.count; i++) indices.push(idx.getX(i) + indexOffset)
    } else {
      for (let i = 0; i < pos.count; i++) indices.push(indexOffset + i)
    }
    indexOffset += pos.count
  }

  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  if (normals.length) {
    out.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  } else {
    out.computeVertexNormals()
  }
  if (uvs.length) {
    out.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  }
  out.setIndex(indices)
  out.translate(0, -0.5, 0)
  out.computeBoundingBox()
  out.computeBoundingSphere()
  return out
}

function scenePose(
  p: Placement,
  container: ContainerSpec,
  progress: number,
): {
  x: number
  y: number
  z: number
  sx: number
  sy: number
  sz: number
  rotZ: number
} {
  const ox = -container.length / 2
  const oz = -container.width / 2
  const targetX = ox + p.x + p.length / 2
  const targetY = p.y + p.height / 2
  const targetZ = oz + p.z + p.width / 2

  const startX = container.length / 2 + 1.8
  const lift = 0.32 + Math.min(0.28, p.height * 0.1)

  const travelT = easeInOutCubic(clamp01(progress / 0.74))
  const settleT = easeOutCubic(clamp01((progress - 0.5) / 0.5))
  const approachT = easeOutCubic(clamp01(progress / 0.35))

  const x = startX + (targetX - startX) * travelT

  // Arc in, then settle onto the floor (never below target)
  const arc = Math.sin(Math.PI * clamp01(progress / 0.9))
  const yArc = targetY + lift * arc
  const y =
    progress < 0.5
      ? yArc
      : targetY + Math.max(0, yArc - targetY) * (1 - settleT)

  const rotZ = (1 - approachT) * 0.05 * (1 - settleT)

  // Appear + light squash on landing
  const land = clamp01((progress - 0.68) / 0.32)
  const squash = land > 0 && land < 1 ? Math.sin(land * Math.PI) * 0.04 : 0
  const appear = 0.9 + 0.1 * easeOutCubic(clamp01(progress / 0.22))

  return {
    x,
    y,
    z: targetZ,
    sx: p.length * appear * (1 + squash * 0.55),
    sy: p.height * appear * (1 - squash),
    sz: p.width * appear * (1 + squash * 0.55),
    rotZ,
  }
}

export function PalletInstances({
  jobId,
  placements,
  container,
  animating,
  visibleCount,
}: Props) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const progress = useRef<Float32Array>(new Float32Array(0))
  const started = useRef<Uint8Array>(new Uint8Array(0))
  const lastShown = useRef(0)

  const lowPower = useSimStore((s) => s.lowPower)
  const animSpeed = useSimStore((s) => s.animSpeed)
  const setJobVisibleCount = useSimStore((s) => s.setJobVisibleCount)
  const setJobAnimating = useSimStore((s) => s.setJobAnimating)

  const count = placements.length
  const geometry = useMemo(() => createPalletGeometry(), [])

  const colorArray = useMemo(() => {
    const arr = new Float32Array(Math.max(count, 1) * 3)
    for (let i = 0; i < count; i++) {
      _color.set(placements[i].color)
      arr[i * 3] = _color.r
      arr[i * 3 + 1] = _color.g
      arr[i * 3 + 2] = _color.b
    }
    return arr
  }, [placements, count])

  useEffect(() => {
    progress.current = new Float32Array(count)
    started.current = new Uint8Array(count)
    lastShown.current = 0
    if (!animating && visibleCount >= count && count > 0) {
      progress.current.fill(1)
      started.current.fill(1)
      lastShown.current = count
    }
  }, [placements]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!animating && visibleCount >= count && count > 0) {
      progress.current = new Float32Array(count)
      progress.current.fill(1)
      started.current = new Uint8Array(count)
      started.current.fill(1)
      lastShown.current = count
    }
  }, [animating, visibleCount, count])

  useEffect(() => () => geometry.dispose(), [geometry])

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh || count === 0) return
    for (let i = 0; i < count; i++) {
      _color.setRGB(
        colorArray[i * 3],
        colorArray[i * 3 + 1],
        colorArray[i * 3 + 2],
      )
      mesh.setColorAt(i, _color)
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [colorArray, count])

  useFrame((_, delta) => {
    const mesh = meshRef.current
    if (!mesh || count === 0) return

    const duration = (lowPower ? 0.4 : 0.58) / animSpeed
    const staggerAt = 0.46

    if (animating) {
      if (!started.current[0] && count > 0) started.current[0] = 1

      let allDone = true
      for (let i = 0; i < count; i++) {
        if (!started.current[i]) {
          allDone = false
          continue
        }
        if (progress.current[i] < 1) {
          progress.current[i] = Math.min(1, progress.current[i] + delta / duration)
          allDone = false

          if (
            progress.current[i] >= staggerAt &&
            i + 1 < count &&
            !started.current[i + 1]
          ) {
            started.current[i + 1] = 1
          }

          if (progress.current[i] >= 0.8) {
            const shown = i + 1
            if (shown > lastShown.current) {
              lastShown.current = shown
              setJobVisibleCount(jobId, shown)
            }
          }
        }
      }

      if (allDone) {
        if (lastShown.current < count) {
          lastShown.current = count
          setJobVisibleCount(jobId, count)
        }
        setJobAnimating(jobId, false)
      }
    }

    for (let i = 0; i < count; i++) {
      const prog = progress.current[i] ?? 0
      if (prog <= 0) {
        _obj.position.set(0, -20, 0)
        _obj.scale.set(0.001, 0.001, 0.001)
        _obj.rotation.set(0, 0, 0)
      } else {
        const pose = scenePose(placements[i], container, prog)
        _obj.position.set(pose.x, pose.y, pose.z)
        _obj.scale.set(pose.sx, pose.sy, pose.sz)
        _obj.rotation.set(0, 0, pose.rotZ)
      }
      _obj.updateMatrix()
      mesh.setMatrixAt(i, _obj.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  if (count === 0) return null

  return (
    <instancedMesh
      key={placements.map((p) => p.instanceId).join('|')}
      ref={meshRef}
      args={[geometry, undefined, count]}
      frustumCulled={false}
      castShadow={!lowPower}
      receiveShadow={!lowPower}
    >
      <meshStandardMaterial roughness={0.58} metalness={0.08} envMapIntensity={0.55} />
    </instancedMesh>
  )
}
