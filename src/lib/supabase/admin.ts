import { createClient } from '@supabase/supabase-js'

/**
 * service role — ข้าม RLS ทั้งหมด
 * ใช้ได้เฉพาะใน server action ที่ยืนยันแล้วว่าผู้เรียกเป็นพี่ค่าย
 * ห้าม import จาก client component เด็ดขาด
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}
