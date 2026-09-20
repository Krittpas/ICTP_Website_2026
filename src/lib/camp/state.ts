import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { CampState } from '@/types/app'

/** อ่านไม่ได้ = ถือว่ายังไม่เปิด ล้มไปทางที่ปลอดภัยกว่า */
const CLOSED: CampState = {
  camp_open: false,
  opens_at: null,
  decrypt_unlocked: false,
  decrypt_unlock_mode: null,
}

export const getCampState = cache(async (): Promise<CampState> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('camp_state')
    .select('camp_open, opens_at, decrypt_unlocked, decrypt_unlock_mode')
    .eq('id', 1)
    .single()

  return error || !data ? CLOSED : (data as CampState)
})
