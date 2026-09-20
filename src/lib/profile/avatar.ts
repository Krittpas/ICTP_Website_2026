/**
 * รูปโปรไฟล์ — ที่เก็บ "avatars" (migration 013) เปิดอ่านสาธารณะ
 * แต่ละคนเขียนได้เฉพาะโฟลเดอร์ <uuid ของตัวเอง>/ และ profiles.avatar_url
 * ต้องชี้ไปไฟล์ในโฟลเดอร์ของเจ้าของแถวเท่านั้น (ฐานข้อมูลตรวจเอง)
 */
export const AVATAR_BUCKET = 'avatars'
/** รูปถูกย่อเป็นสี่เหลี่ยมจัตุรัสขนาดนี้ในเบราว์เซอร์ก่อนอัปโหลด */
export const AVATAR_SIZE = 512
/** ขนาดไฟล์ต้นฉบับที่ยอมให้เลือก — ย่อแล้วเหลือไม่กี่สิบ KB ต่ำกว่าเพดาน 2 MB ของที่เก็บเสมอ */
export const MAX_AVATAR_SOURCE_BYTES = 15 * 1024 * 1024
export const AVATAR_SOURCE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

/** ต้องตรงกับ profiles_avatar_own_folder ใน migration 013 */
export function isOwnAvatarPath(path: string, userId: string) {
  return new RegExp('^' + userId + '/[0-9a-f-]{36}\\.(webp|jpg|png)$').test(path)
}

export function avatarUrl(path: string | null | undefined) {
  return path ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${AVATAR_BUCKET}/${path}` : null
}
