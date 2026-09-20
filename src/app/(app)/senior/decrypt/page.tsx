import Link from 'next/link'
import { Lock, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth/dal'
import { getPuzzleTotals } from '@/lib/camp/totals'
import { toGoldenKeys } from '@/lib/camp/keys'
import { getMySenior } from '@/actions/decrypt'
import { DecryptTerminal } from '@/components/decrypt/DecryptTerminal'
import { GoldenKeys } from '@/components/camp/GoldenKeys'
import type { City, CityProgress } from '@/types/app'

export const metadata = { title: 'เครื่องถอดรหัส' }

export default async function DecryptPage() {
  await requireUser()

  // สถานะมาจาก RPC ที่ตรวจการเปิดประตูเอง ต่อให้เดา route ถูกก็ไม่ได้ข้อมูลพี่รหัสไป
  const senior = await getMySenior()

  if (senior.status === 'locked') return <LockedDoor />

  if (senior.status === 'admin') {
    return (
      <div className="panel" style={{ maxWidth: 560, margin: '1rem auto 0', padding: '2rem 1.75rem', textAlign: 'center' }}>
        <ShieldCheck size={44} className="icon-center" color="var(--brass)" strokeWidth={1.4} aria-hidden="true" />
        <h1 style={{ fontFamily: 'var(--display)', fontSize: '1.5rem', color: 'var(--brass-lit)', margin: '0.8rem 0 0.5rem' }}>
          ประตูเปิดแล้ว
        </h1>
        <p style={{ margin: 0, fontSize: '0.92rem', lineHeight: 1.8, color: 'var(--muted)' }}>
          เครื่องถอดรหัสใช้กับรหัสลับของน้องค่ายแต่ละคน<br />
          ดูว่าใครเปิดเผยพี่รหัสแล้วบ้างได้ที่ <Link href="/admin">หน้าพี่ค่าย</Link>
        </p>
      </div>
    )
  }

  return <DecryptTerminal initial={senior} />
}

async function LockedDoor() {
  const supabase = await createClient()
  const [{ data: cities }, { data: progress }] = await Promise.all([
    supabase.from('cities').select('*').order('id'),
    supabase.from('city_progress').select('city_id, current_seat, solved_count, last_solved_at'),
  ])
  const townList = (cities ?? []) as City[]
  const byCity: Record<number, CityProgress> = {}
  for (const row of (progress ?? []) as CityProgress[]) byCity[row.city_id] = row
  const totals = await getPuzzleTotals(townList.map(c => c.id))
  const keys = toGoldenKeys(townList, byCity, totals.byCity)

  return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '1rem' }}>
      <div className="panel" style={{ maxWidth: 620, width: '100%', padding: '2.5rem 1.75rem', textAlign: 'center' }}>
        <Lock size={52} className="icon-center" color="var(--ember)" strokeWidth={1.3} aria-hidden="true" />
        <h1 style={{ fontFamily: 'var(--display)', fontSize: '1.7rem', color: 'var(--ember)', margin: '1rem 0 0.6rem' }}>
          ประตูสำนักงานนายอำเภอยังปิดตาย
        </h1>
        <p style={{ margin: '0 0 1.6rem', fontSize: '0.92rem', lineHeight: 1.85, color: 'var(--muted)' }}>
          รวมชิ้นส่วนกุญแจทองคำจากทั้ง 6 เมืองให้ครบ ประตูจะเปิดเอง<br />
          แต่ละเมืองได้กุญแจหนึ่งชิ้นเมื่อคาวบอยทั้ง 6 คนไขปริศนาครบ
        </p>
        <div style={{ textAlign: 'left' }}>
          <GoldenKeys keys={keys} />
        </div>
      </div>
    </div>
  )
}
