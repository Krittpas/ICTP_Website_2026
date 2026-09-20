import { redirect } from 'next/navigation'

/** รวมเข้ากับหน้าปริศนาแล้ว — คงเส้นทางเดิมไว้เผื่อมีใครจดลิงก์ไว้ */
export default function OverviewRedirect() {
  redirect('/senior/puzzles')
}
