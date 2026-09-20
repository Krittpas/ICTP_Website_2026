'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getActionUser } from '@/lib/auth/dal'
import { AVATAR_BUCKET, isOwnAvatarPath } from '@/lib/profile/avatar'

export type ProfileState = { ok?: true; error?: string } | null

/**
 * เปลี่ยนรูปโปรไฟล์ของตัวเอง — สิ่งเดียวในโปรไฟล์ที่น้องแก้เองได้
 * ชื่อ-นามสกุลและชื่อเล่นพี่ค่ายเป็นคนตั้ง ฐานข้อมูลถอนสิทธิ์แก้สองคอลัมน์นั้นแล้ว (migration 014)
 * ตัวรูปถูกย่อและอัปโหลดจากเบราว์เซอร์ไปที่ Storage แล้ว ที่นี่รับแค่ path
 */
export async function updateProfileAction(_p: ProfileState, formData: FormData): Promise<ProfileState> {
  const user = await getActionUser()
  if (!user) return { error: 'กรุณาเข้าสู่ระบบใหม่' }

  // ไม่ส่งมา = ไม่มีอะไรเปลี่ยน · '' = เอารูปออก · path = รูปใหม่ในโฟลเดอร์ของตัวเอง
  const raw = formData.get('avatar_path')
  if (raw === null) return { ok: true }
  const avatar = String(raw) || null
  if (avatar && !isOwnAvatarPath(avatar, user.id)) return { error: 'รูปโปรไฟล์ไม่ถูกต้อง ลองเลือกใหม่อีกครั้ง' }

  const supabase = await createClient()
  const { error } = await supabase.from('profiles').update({ avatar_url: avatar }).eq('id', user.id)
  if (error) return { error: error.message }

  // รูปเก่าที่ถูกแทนที่ ลบทิ้ง — ลบไม่สำเร็จแค่เหลือไฟล์ค้าง
  if (user.avatarUrl && user.avatarUrl !== avatar) {
    const { error: rmError } = await supabase.storage.from(AVATAR_BUCKET).remove([user.avatarUrl])
    if (rmError) console.error('remove old avatar:', rmError.message)
  }

  revalidatePath('/', 'layout')
  return { ok: true }
}
