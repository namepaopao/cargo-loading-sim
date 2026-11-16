import type { ContainerSpec, ContainerType, TransportMode } from './types'

/** ISO 668 Series 1 dry cargo — internal dims (m) and typical rating (kg). */
export const CONTAINER_SPECS: Record<ContainerType, ContainerSpec> = {
  '20GP': {
    type: '20GP',
    label: 'ISO 20GP (20′)',
    length: 5.898,
    width: 2.352,
    height: 2.393,
    doorHeight: 2.28,
    tare: 2230,
    structuralPayload: 21770,
  },
  '40GP': {
    type: '40GP',
    label: 'ISO 40GP (40′)',
    length: 12.032,
    width: 2.352,
    height: 2.393,
    doorHeight: 2.28,
    tare: 3700,
    structuralPayload: 26780,
  },
}

/**
 * Payload limits (kg of cargo+pallets) for ISO containers.
 * Sea and rail both use ISO 668 ratings (structural payload).
 */
export const TRANSPORT_PAYLOAD: Record<
  TransportMode,
  Record<ContainerType, number>
> = {
  sea: {
    '20GP': 21770,
    '40GP': 26780,
  },
  rail: {
    '20GP': 21770,
    '40GP': 26780,
  },
}

export const TRANSPORT_LABELS: Record<TransportMode, string> = {
  sea: '海运',
  rail: '铁路',
}

export function getPayloadLimit(
  containerType: ContainerType,
  mode: TransportMode,
): number {
  const structural = CONTAINER_SPECS[containerType].structuralPayload
  const modeLimit = TRANSPORT_PAYLOAD[mode][containerType]
  return Math.min(structural, modeLimit)
}

export function getUsableHeight(spec: ContainerSpec): number {
  return Math.min(spec.height, spec.doorHeight)
}
