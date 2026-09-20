import { createClient } from '@/lib/supabase/server'

export interface PuzzleTotals {
  byCity: Record<number, number>
  total: number
}

/** ถ้ายังไม่ได้รัน migration 006 ให้ถือว่าเมืองละ 6 ที่นั่งตามแบบเดิม */
const DEFAULT_SEATS = 6

/**
 * จำนวนปริศนาที่เปิดใช้จริงรายเมือง — ใช้ตัวเลขเดียวกับที่ฐานข้อมูลใช้ตัดสินปลดเครื่องถอดรหัส
 * ถ้าหน้าเว็บคิดเองว่า "6 × จำนวนเมือง" ตัวเลขจะเพี้ยนทันทีที่ปิดปริศนาบางข้อ
 */
export async function getPuzzleTotals(cityIds: number[]): Promise<PuzzleTotals> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_puzzle_totals')

  const byCity: Record<number, number> = {}
  if (!error && Array.isArray(data)) {
    for (const row of data as { city_id: number; total: number }[]) byCity[row.city_id] = row.total
  } else {
    for (const id of cityIds) byCity[id] = DEFAULT_SEATS
  }

  const total = Object.values(byCity).reduce((sum, n) => sum + n, 0)
  return { byCity, total }
}
