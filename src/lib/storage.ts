/**
 * ตัวช่วยร่วมของไฟล์ใน Supabase Storage (ประกาศ · รูปปริศนา)
 *
 * ชื่อไฟล์ภาษาไทยใช้เป็น key ใน Storage ไม่ได้ จึงตั้ง key เป็น <uuid>/file.<นามสกุล>
 * แล้วเก็บชื่อจริงไว้ที่อื่นถ้าต้องใช้
 */
export const STORAGE_KEY = /^[0-9a-f-]{36}\/file(\.[a-z0-9]{1,8})?$/

export function storageKeyFor(fileName: string) {
  const ext = fileName.toLowerCase().match(/\.([a-z0-9]{1,8})$/)?.[1]
  return `${crypto.randomUUID()}/file${ext ? `.${ext}` : ''}`
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
