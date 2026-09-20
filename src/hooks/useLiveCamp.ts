'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * ฟังความเปลี่ยนแปลงของ city_progress และ camp_state
 *
 * ไม่เก็บสถานะเองทั้งก้อน แต่สั่ง router.refresh() ให้ server component
 * ดึงข้อมูลใหม่ — ข้อมูลที่แสดงจึงผ่าน RLS เสมอ ไม่มีทางหลุดสิ่งที่ไม่ควรเห็น
 */
export function useLiveCamp() {
  const router = useRouter()
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('camp-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'city_progress' }, () => router.refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'camp_state' },    () => router.refresh())
      .subscribe(status => setConnected(status === 'SUBSCRIBED'))

    return () => { supabase.removeChannel(channel) }
  }, [router])

  return { connected }
}
