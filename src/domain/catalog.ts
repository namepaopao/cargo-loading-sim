import type { PalletSku } from './types'

/**
 * Demo cargo SKUs on ISO 6780:2003 flat-pallet plan sizes
 * (intercontinental materials handling — principal dimensions).
 *
 * Rectangular: 1200×800, 1200×1000, 1219×1016
 * Square:      1067×1067, 1100×1100, 1140×1140
 *
 * Length × width are pallet plan dims (m); height/weight are demo unit loads.
 */
/**
 * Unit-load heights are demo values tuned so 2-high fits under GP door
 * opening (2.28 m): each stackable SKU ≤ 1.14 m.
 */
export const PALLET_CATALOG: PalletSku[] = [
  {
    id: 'iso-1200x1000',
    name: 'ISO 1200×1000',
    length: 1.2,
    width: 1.0,
    height: 1.1,
    weight: 500,
    color: '#d2b06a',
    canRotate: true,
    canStack: true,
    description:
      'ISO 6780 矩形 · 欧亚/英国常用 · 演示堆高 1.1 m（可两层过门）',
  },
  {
    id: 'iso-1200x800',
    name: 'ISO 1200×800 (EUR)',
    length: 1.2,
    width: 0.8,
    height: 1.1,
    weight: 450,
    color: '#5f9a72',
    canRotate: true,
    canStack: true,
    description: 'ISO 6780 矩形 · 欧洲 EUR/EPAL 1 · 演示堆高 1.1 m（可两层过门）',
  },
  {
    id: 'iso-1219x1016',
    name: 'ISO 1219×1016 (GMA)',
    length: 1.219,
    width: 1.016,
    height: 1.1,
    weight: 550,
    color: '#6fa3cc',
    canRotate: true,
    canStack: true,
    description: 'ISO 6780 矩形 · 北美 GMA · 演示堆高 1.1 m（可两层过门）',
  },
  {
    id: 'iso-1100x1100',
    name: 'ISO 1100×1100',
    length: 1.1,
    width: 1.1,
    height: 1.1,
    weight: 480,
    color: '#9a5e32',
    canRotate: true,
    canStack: true,
    description: 'ISO 6780 方形 · 日韩及亚洲常用 · 演示堆高 1.1 m（可两层过门）',
  },
  {
    id: 'iso-1140x1140',
    name: 'ISO 1140×1140',
    length: 1.14,
    width: 1.14,
    height: 1.2,
    weight: 520,
    color: '#b07a52',
    canRotate: true,
    canStack: false,
    description: 'ISO 6780 方形 · 澳新等 · 本 SKU 演示禁止叠放（1.2 m）',
  },
  {
    id: 'iso-1067x1067',
    name: 'ISO 1067×1067',
    length: 1.067,
    width: 1.067,
    height: 1.05,
    weight: 400,
    color: '#c07a98',
    canRotate: true,
    canStack: true,
    description: 'ISO 6780 方形 · 42×42 in · 演示堆高 1.05 m（可两层过门）',
  },
]

export function getSku(id: string): PalletSku | undefined {
  return PALLET_CATALOG.find((s) => s.id === id)
}
