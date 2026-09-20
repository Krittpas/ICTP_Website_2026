import type { createClient } from '@/lib/supabase/server'
import type { Announcement } from '@/types/app'

const BASE = 'id, title, body, creator_display_name, created_at, published_at, updated_at, is_pinned'

/**
 * ประกาศเรียงปักหมุดก่อน แล้วใหม่ก่อน
 * ยังไม่ได้รัน migration 011 = ไม่มีคอลัมน์ attachments ถ้าขอไปทั้งคำขอจะพังและกระดานว่าง
 * จึงถอยไปขอแบบไม่มีไฟล์แนบแทน
 */
export async function fetchAnnouncements(
  supabase: Awaited<ReturnType<typeof createClient>>,
  limit?: number,
): Promise<Announcement[]> {
  const query = (cols: string) => {
    const q = supabase.from('announcements').select(cols)
      .order('is_pinned', { ascending: false })
      .order('published_at', { ascending: false })
    return limit ? q.limit(limit) : q
  }

  const withFiles = await query(`${BASE}, attachments`)
  if (!withFiles.error) return (withFiles.data ?? []) as unknown as Announcement[]

  const plain = await query(BASE)
  return (plain.data ?? []) as unknown as Announcement[]
}
