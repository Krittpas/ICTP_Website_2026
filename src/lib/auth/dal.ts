import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AVATAR_BUCKET, AVATAR_URL_TTL } from '@/lib/profile/avatar'
import type { SessionUser, UserRole } from '@/types/app'

/**
 * ใช้ getUser() ไม่ใช่ getSession()
 * getSession() อ่าน cookie โดยไม่ตรวจลายเซ็น JWT จึงใช้ตัดสินสิทธิ์ไม่ได้
 * cache() ทำให้หลายคอมโพเนนต์ในหน้าเดียวกันใช้ผลร่วมกันโดยไม่ยิงซ้ำ
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, nickname, avatar_url, role, city_id, seat_index')
    .eq('id', user.id)
    .single()

  // ที่เก็บรูปโปรไฟล์เป็นแบบส่วนตัว (migration 018) จึงต้องขอลิงก์ชั่วคราวทุกครั้ง
  // ขอด้วยสิทธิ์ของเจ้าตัวเอง — policy ยอมออกลิงก์ให้เฉพาะไฟล์ในโฟลเดอร์ของตัวเองเท่านั้น
  const path = profile?.avatar_url ?? null
  let avatarSrc: string | null = null
  if (path) {
    const { data } = await supabase.storage.from(AVATAR_BUCKET).createSignedUrl(path, AVATAR_URL_TTL)
    avatarSrc = data?.signedUrl ?? null
  }

  return {
    id: user.id,
    email: user.email ?? '',
    displayName: profile?.display_name ?? '',
    nickname: profile?.nickname ?? '',
    avatarUrl: path,
    avatarSrc,
    role: (profile?.role ?? 'student') as UserRole,
    cityId: profile?.city_id ?? null,
    seatIndex: profile?.seat_index ?? null,
  }
})

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return user
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser()
  if (user.role !== 'admin') redirect('/camp')
  return user
}

/** สำหรับ server action — คืนค่าแทน redirect เพื่อให้ส่งข้อความกลับไปที่ฟอร์มได้ */
export const getActionUser = () => getCurrentUser()

export async function getActionAdmin(): Promise<SessionUser | null> {
  const user = await getCurrentUser()
  return user?.role === 'admin' ? user : null
}
