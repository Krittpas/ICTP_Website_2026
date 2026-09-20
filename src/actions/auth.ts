'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isCampEmail, normalizeEmail } from '@/lib/auth/email'

export type LoginState = { error?: string } | null

/** ข้อความเดียวสำหรับทุกกรณี — ไม่บอกว่าอีเมลไหนมีอยู่จริง */
const FAILED = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const rawEmail = String(formData.get('email') ?? '')
  const password = String(formData.get('password') ?? '')

  if (!rawEmail || !password) return { error: 'กรุณากรอกอีเมลและรหัสผ่าน' }

  const email = normalizeEmail(rawEmail)
  if (!isCampEmail(email)) return { error: 'ใช้ได้เฉพาะอีเมลโรงเรียน (sXXXXX@bj.ac.th)' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: FAILED }

  redirect('/camp')
}

export async function logoutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/')
}
