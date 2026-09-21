/**
 * รูปโปรไฟล์ — ที่เก็บ "avatars" เป็นแบบส่วนตัวตั้งแต่ migration 018
 *
 * แต่ละคนเขียน/อ่านได้เฉพาะโฟลเดอร์ <uuid ของตัวเอง>/ (policy ใน 013)
 * และ profiles.avatar_url ต้องชี้ไปไฟล์ในโฟลเดอร์ของเจ้าของแถวเท่านั้น (CHECK ใน 013)
 * หน้าเว็บแสดงรูปของ "ตัวเอง" ที่เดียว จึงขอลิงก์ชั่วคราวตอนโหลดหน้าได้เลย
 */
export const AVATAR_BUCKET = 'avatars'
/** รูปถูกย่อเป็นสี่เหลี่ยมจัตุรัสขนาดนี้ในเบราว์เซอร์ก่อนอัปโหลด */
export const AVATAR_SIZE = 512
/** อายุลิงก์รูปโปรไฟล์ — ยาวกว่าเวลาที่หน้าเว็บเปิดค้างได้ แต่ยังหมดอายุในวันเดียวกัน */
export const AVATAR_URL_TTL = 12 * 60 * 60
/** ขนาดไฟล์ต้นฉบับที่ยอมให้เลือก — ย่อแล้วเหลือไม่กี่สิบ KB ต่ำกว่าเพดาน 2 MB ของที่เก็บเสมอ */
export const MAX_AVATAR_SOURCE_BYTES = 15 * 1024 * 1024
export const AVATAR_SOURCE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

/** ต้องตรงกับ profiles_avatar_own_folder ใน migration 013 */
export function isOwnAvatarPath(path: string, userId: string) {
  return new RegExp('^' + userId + '/[0-9a-f-]{36}\\.(webp|jpg|png)$').test(path)
}
