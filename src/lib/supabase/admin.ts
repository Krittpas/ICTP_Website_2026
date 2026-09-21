import { createClient } from '@supabase/supabase-js'

/**
 * service role — ข้ามทั้ง RLS และสิทธิ์ระดับคอลัมน์ทั้งหมด
 * ใช้ได้เฉพาะใน server action ที่ยืนยันแล้วว่าผู้เรียกเป็นพี่ค่าย
 * ห้าม import จาก client component เด็ดขาด
 *
 * สองด่านข้างล่างเป็นตาข่ายรองรับ ไม่ใช่ด่านหลัก:
 * ถ้าวันไหนมีใครเผลอ import ไฟล์นี้เข้าไปในโค้ดฝั่งเบราว์เซอร์ ให้พังทันทีและดังที่สุด
 * ดีกว่าปล่อยให้คีย์ที่ข้าม RLS ได้หลุดไปอยู่ในไฟล์ JS ที่ใครก็โหลดได้
 */
export function createAdminClient() {
  if (typeof window !== 'undefined') {
    throw new Error('createAdminClient() ถูกเรียกจากเบราว์เซอร์ — service role ต้องอยู่ฝั่ง server เท่านั้น')
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  // ไม่มีคีย์แล้วปล่อยผ่าน = ไปเรียก API ด้วยสิทธิ์ที่ต่ำกว่าแล้วได้ error ที่อ่านไม่รู้เรื่องทีหลัง
  if (!url || !key) {
    throw new Error('ยังไม่ได้ตั้ง SUPABASE_SERVICE_ROLE_KEY หรือ NEXT_PUBLIC_SUPABASE_URL ฝั่ง server')
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
