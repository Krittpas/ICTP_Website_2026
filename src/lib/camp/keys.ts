import type { City, CityProgress } from '@/types/app'

export interface GoldenKey {
  cityId: number
  name: string
  accent: string
  collected: boolean
}

/**
 * ชิ้นส่วนกุญแจทองคำ — เมืองที่ไขปริศนาครบทุกข้อที่เปิดใช้ได้หนึ่งชิ้น
 * ไม่มีตารางของตัวเอง คำนวณจากความคืบหน้าเดียวกับที่ฐานข้อมูลใช้ปลดประตู
 */
export function toGoldenKeys(
  cities: City[],
  progress: Record<number, CityProgress>,
  totals: Record<number, number>,
): GoldenKey[] {
  return cities.map(city => {
    const seats = totals[city.id] ?? 0
    return {
      cityId: city.id,
      name: city.name_en,
      accent: city.accent_hex,
      collected: seats > 0 && (progress[city.id]?.solved_count ?? 0) >= seats,
    }
  })
}
