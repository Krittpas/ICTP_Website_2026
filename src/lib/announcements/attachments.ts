/**
 * ไฟล์แนบของประกาศ — ใช้ร่วมกันทั้งฝั่งเบราว์เซอร์ (อัปโหลด/พรีวิว) และฝั่ง server (ตรวจก่อนบันทึก)
 *
 * ตัวไฟล์อยู่ใน Supabase Storage ที่เก็บ "announcements" (สร้างใน migration 011)
 * ตารางเก็บแค่ path กับชื่อเดิม ชื่อเดิมใช้แสดงและตั้งชื่อตอนดาวน์โหลด
 */
import { STORAGE_KEY } from '@/lib/storage'

export { formatBytes, storageKeyFor } from '@/lib/storage'

export const ANNOUNCEMENT_BUCKET = 'announcements'
export const MAX_ATTACHMENTS = 10
/** ต้องตรงกับ file_size_limit ของที่เก็บไฟล์ใน migration 011 */
export const MAX_FILE_BYTES = 10 * 1024 * 1024

/** ต้องตรงกับ allowed_mime_types ใน migration 011 */
export const ACCEPTED_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf', 'text/plain', 'application/zip',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]

export interface Attachment {
  path: string
  name: string
  type: string
  size: number
}

export const isImage = (a: Pick<Attachment, 'type'>) => a.type.startsWith('image/')

export function attachmentUrl(a: Pick<Attachment, 'path'>, download?: string) {
  const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${ANNOUNCEMENT_BUCKET}/${a.path}`
  return download === undefined ? base : `${base}?download=${encodeURIComponent(download)}`
}

/** ตรวจรายการไฟล์แนบที่ส่งมาจากฟอร์ม — ผิดรูปแบบข้อไหนก็ตาม = ปฏิเสธทั้งก้อน */
export function parseAttachments(raw: unknown): Attachment[] | null {
  if (raw === null || raw === undefined || raw === '') return []
  let list: unknown
  try { list = JSON.parse(String(raw)) } catch { return null }
  if (!Array.isArray(list) || list.length > MAX_ATTACHMENTS) return null

  const out: Attachment[] = []
  for (const item of list) {
    const { path, name, type, size } = (item ?? {}) as Record<string, unknown>
    // key ที่เราสร้างเองเท่านั้น — กันการยัด path หรือ URL ภายนอกเข้ามาในประกาศ
    if (typeof path !== 'string' || !STORAGE_KEY.test(path)) return null
    if (typeof name !== 'string' || !name.trim() || name.length > 200) return null
    if (typeof type !== 'string' || !ACCEPTED_TYPES.includes(type)) return null
    if (typeof size !== 'number' || size < 0 || size > MAX_FILE_BYTES) return null
    out.push({ path, name: name.trim(), type, size })
  }
  return out
}
