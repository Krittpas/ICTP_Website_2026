import { redirect } from 'next/navigation'

/** ย้ายไปอยู่ใต้ "ตามหาพี่รหัส" แล้ว — คงเส้นทางเดิมไว้เผื่อมีใครจดลิงก์ไว้ */
export default function DecryptRedirect() {
  redirect('/senior/decrypt')
}
