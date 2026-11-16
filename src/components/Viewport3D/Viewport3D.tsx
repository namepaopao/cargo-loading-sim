import { Canvas } from '@react-three/fiber'
import {
  ContactShadows,
  Environment,
  OrbitControls,
} from '@react-three/drei'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { CONTAINER_SPECS } from '../../domain/containerSpecs'
import type { ContainerJob } from '../../domain/types'
import { useSimStore } from '../../state/useSimStore'
import { ContainerMesh } from './ContainerMesh'
import { PalletInstances } from './PalletInstances'
import { PalletLabels } from './PalletLabels'
import styles from './Viewport3D.module.css'

const GAP_Z = 1.2
/** Extra spacing between 20GP cluster and 40GP cluster */
const GROUP_GAP_Z = 2.4

const TYPE_ORDER = { '20GP': 0, '40GP': 1 } as const

/** Keep same-size cabinets together: all 20′ then all 40′ (stable within type). */
function groupJobsByType(jobs: ContainerJob[]): ContainerJob[] {
  return [...jobs].sort(
    (a, b) => TYPE_ORDER[a.type] - TYPE_ORDER[b.type],
  )
}

function layoutOffsets(jobs: ContainerJob[]): number[] {
  if (jobs.length === 0) return []
  const gaps = jobs.map((_, i) => {
    if (i === 0) return 0
    return jobs[i].type !== jobs[i - 1].type ? GROUP_GAP_Z : GAP_Z
  })
  const widths = jobs.map((j) => CONTAINER_SPECS[j.type].width)
  const total =
    widths.reduce((a, b) => a + b, 0) + gaps.reduce((a, b) => a + b, 0)
  let cursor = -total / 2
  return widths.map((w, i) => {
    cursor += gaps[i]
    const center = cursor + w / 2
    cursor += w
    return center
  })
}

function CameraRig({ jobs }: { jobs: ContainerJob[] }) {
  const { camera } = useThree()
  const maxLen = Math.max(...jobs.map((j) => CONTAINER_SPECS[j.type].length), 6)
  const maxH = Math.max(...jobs.map((j) => CONTAINER_SPECS[j.type].height), 2.4)
  const gapSum = jobs.reduce((sum, j, i) => {
    if (i === 0) return sum
    return sum + (j.type !== jobs[i - 1].type ? GROUP_GAP_Z : GAP_Z)
  }, 0)
  const spanZ =
    jobs.reduce((s, j) => s + CONTAINER_SPECS[j.type].width, 0) + gapSum

  useEffect(() => {
    camera.position.set(
      maxLen * 0.88,
      maxH * 1.28,
      Math.max(spanZ * 0.95, 6.2),
    )
    camera.lookAt(0, maxH * 0.32, 0)
    camera.updateProjectionMatrix()
  }, [camera, maxLen, maxH, spanZ, jobs.length])

  return null
}

function SelectionMarker({
  length: L,
  width: W,
  height: H,
}: {
  length: number
  width: number
  height: number
}) {
  const padRef = useRef<THREE.Mesh>(null)
  const frameRef = useRef<THREE.LineSegments>(null)
  const outlineRef = useRef<THREE.LineSegments>(null)
  const postsRef = useRef<THREE.Group>(null)

  const groundFrame = useMemo(() => {
    const box = new THREE.BoxGeometry(L + 0.7, 0.01, W + 0.7)
    const edges = new THREE.EdgesGeometry(box)
    box.dispose()
    return edges
  }, [L, W])

  const shellOutline = useMemo(() => {
    const box = new THREE.BoxGeometry(L + 0.22, H + 0.14, W + 0.22)
    const edges = new THREE.EdgesGeometry(box)
    box.dispose()
    return edges
  }, [L, W, H])

  useEffect(() => {
    return () => {
      groundFrame.dispose()
      shellOutline.dispose()
    }
  }, [groundFrame, shellOutline])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const pulse = 0.5 + Math.sin(t * 2.4) * 0.22
    const pad = padRef.current
    if (pad) {
      ;(pad.material as THREE.MeshBasicMaterial).opacity = pulse
    }
    const frame = frameRef.current
    if (frame) {
      ;(frame.material as THREE.LineBasicMaterial).opacity =
        0.75 + Math.sin(t * 2.4 + 0.5) * 0.2
    }
    const outline = outlineRef.current
    if (outline) {
      ;(outline.material as THREE.LineBasicMaterial).opacity =
        0.7 + Math.sin(t * 2.4 + 1) * 0.25
    }
    const posts = postsRef.current
    if (posts) {
      posts.children.forEach((child, i) => {
        const mesh = child as THREE.Mesh
        ;(mesh.material as THREE.MeshBasicMaterial).opacity =
          0.7 + Math.sin(t * 2.4 + i * 0.45) * 0.28
      })
    }
  })

  const postH = H + 0.18
  const corners: [number, number, number][] = [
    [L / 2 + 0.1, postH / 2, W / 2 + 0.1],
    [L / 2 + 0.1, postH / 2, -W / 2 - 0.1],
    [-L / 2 - 0.1, postH / 2, W / 2 + 0.1],
    [-L / 2 - 0.1, postH / 2, -W / 2 - 0.1],
  ]

  return (
    <group>
      <mesh ref={padRef} position={[0, -0.04, 0]}>
        <boxGeometry args={[L + 0.6, 0.03, W + 0.6]} />
        <meshBasicMaterial
          color="#0d7a86"
          transparent
          opacity={0.45}
          depthWrite={false}
        />
      </mesh>
      <lineSegments ref={frameRef} position={[0, -0.02, 0]} geometry={groundFrame}>
        <lineBasicMaterial color="#0a96a5" transparent opacity={0.95} />
      </lineSegments>
      <group ref={postsRef}>
        {corners.map(([x, y, z], i) => (
          <mesh key={i} position={[x, y, z]}>
            <boxGeometry args={[0.06, postH, 0.06]} />
            <meshBasicMaterial
              color="#0d7a86"
              transparent
              opacity={0.9}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>
      <lineSegments
        ref={outlineRef}
        position={[0, H / 2, 0]}
        geometry={shellOutline}
      >
        <lineBasicMaterial color="#0a96a5" transparent opacity={0.95} />
      </lineSegments>
    </group>
  )
}

function JobGroup({
  job,
  offsetZ,
  highlighted,
}: {
  job: ContainerJob
  offsetZ: number
  highlighted: boolean
}) {
  const spec = CONTAINER_SPECS[job.type]
  const overweight = job.result?.overweight ?? false
  const placements = job.result?.placements ?? []

  return (
    <group position={[0, 0, offsetZ]}>
      {highlighted && (
        <SelectionMarker
          length={spec.length}
          width={spec.width}
          height={spec.height}
        />
      )}
      <ContainerMesh
        spec={spec}
        overweight={overweight}
        highlighted={highlighted}
      />
      <PalletInstances
        jobId={job.id}
        placements={placements}
        container={spec}
        animating={job.animating}
        visibleCount={job.visibleCount}
      />
      <PalletLabels
        placements={placements}
        container={spec}
        visibleCount={job.visibleCount}
      />
    </group>
  )
}

function Scene() {
  const jobs = useSimStore((s) => s.jobs)
  const activeJobId = useSimStore((s) => s.activeJobId)
  const lowPower = useSimStore((s) => s.lowPower)
  const layoutJobs = useMemo(() => groupJobsByType(jobs), [jobs])
  const offsets = useMemo(() => layoutOffsets(layoutJobs), [layoutJobs])

  return (
    <>
      <color attach="background" args={['#e4ebf2']} />
      <fog attach="fog" args={['#e4ebf2', 32, 72]} />

      <ambientLight intensity={lowPower ? 0.95 : 0.72} />
      <hemisphereLight
        color="#ffffff"
        groundColor="#c5d0dc"
        intensity={lowPower ? 0.45 : 0.65}
      />
      <directionalLight
        position={[10, 16, 8]}
        intensity={lowPower ? 0.85 : 1.2}
        castShadow={!lowPower}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={1}
        shadow-camera-far={40}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
        shadow-bias={-0.0002}
      />
      <directionalLight position={[-6, 6, -4]} intensity={0.3} color="#9eb6cc" />
      <pointLight position={[4, 3, 0]} intensity={0.28} color="#fff2d8" distance={18} />

      {!lowPower && (
        <Suspense fallback={null}>
          <Environment preset="warehouse" environmentIntensity={0.55} />
        </Suspense>
      )}

      {layoutJobs.map((job, i) => (
        <JobGroup
          key={job.id}
          job={job}
          offsetZ={offsets[i]}
          highlighted={job.id === activeJobId}
        />
      ))}

      {!lowPower && (
        <ContactShadows
          position={[0, -0.02, 0]}
          opacity={0.28}
          scale={28}
          blur={2.6}
          far={8}
          color="#6a7a8a"
        />
      )}

      <CameraRig jobs={layoutJobs} />
      <OrbitControls
        makeDefault
        target={[0, 1, 0]}
        maxPolarAngle={Math.PI * 0.49}
        minDistance={3}
        maxDistance={50}
        enableDamping
        dampingFactor={lowPower ? 0.12 : 0.06}
      />
    </>
  )
}

export function Viewport3D() {
  const lowPower = useSimStore((s) => s.lowPower)
  const jobs = useSimStore((s) => s.jobs)
  const activeJobId = useSimStore((s) => s.activeJobId)
  const active = jobs.find((j) => j.id === activeJobId) ?? jobs[0]
  const overweight = Boolean(active?.result?.overweight)
  const anyOverweight = jobs.some((j) => j.result?.overweight)

  const dpr: [number, number] = lowPower ? [0.75, 1] : [1, 1.5]
  const label = `${jobs.length} 柜 · 当前 ${CONTAINER_SPECS[active.type].label}`

  return (
    <div className={styles.wrap}>
      <div
        className={`${styles.badge} ${anyOverweight || overweight ? styles.badgeWarn : ''}`}
      >
        {anyOverweight ? '存在超重柜' : label}
      </div>
      <div className={styles.hint}>拖拽旋转 · 滚轮缩放 · 同尺柜并排分组</div>
      <Canvas
        className={styles.canvas}
        dpr={dpr}
        shadows={!lowPower}
        gl={{
          antialias: !lowPower,
          powerPreference: lowPower ? 'low-power' : 'default',
          alpha: false,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.05,
        }}
        camera={{
          position: [6, 4, 6],
          fov: 40,
          near: 0.1,
          far: 200,
        }}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
    </div>
  )
}
