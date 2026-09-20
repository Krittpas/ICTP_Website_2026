'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getActionUser } from '@/lib/auth/dal'
import type { SeniorReveal } from '@/types/app'

/** สถานะเครื่องถอดรหัสของฉัน — เคยเปิดเผยแล้วได้ข้อมูลพี่รหัสกลับมาเลย */
export async function getMySenior(): Promise<SeniorReveal> {
  if (!(await getActionUser())) return { status: 'unauthorized' }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_my_senior')
  if (error) {
    console.error('get_my_senior:', error.message)
    return { status: 'error' }
  }
  return data as SeniorReveal
}

/**
 * ใส่รหัสลับประจำตัวเข้าเครื่องถอดรหัส
 * ไม่ตัดสินอะไรที่นี่ — รหัสเป็นของใคร ผ่านปริศนาหรือยัง ลองไปกี่ครั้ง ตัดสินใน reveal_my_senior()
 */
export async function revealSeniorAction(code: string): Promise<SeniorReveal> {
  if (!(await getActionUser())) return { status: 'unauthorized' }

  const trimmed = code?.trim() ?? ''
  if (!trimmed || trimmed.length > 200) return { status: 'incorrect', attempts_left: -1 }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('reveal_my_senior', { p_code: trimmed })
  if (error) {
    console.error('reveal_my_senior:', error.message)
    return { status: 'error' }
  }

  const result = data as SeniorReveal
  if (result.status === 'revealed') revalidatePath('/senior/decrypt')
  return result
}
