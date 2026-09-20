import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/dal'
import { getCampState } from '@/lib/camp/state'
import { getPuzzleTotals } from '@/lib/camp/totals'
import { CampControls } from '@/components/admin/CampControls'
import { OverridePanel } from '@/components/admin/OverridePanel'
import { ForceSolvePanel } from '@/components/admin/ForceSolvePanel'
import { PuzzleEditor } from '@/components/admin/PuzzleEditor'
import { SeniorMatchPanel } from '@/components/admin/SeniorMatchPanel'
import { StudentCreator } from '@/components/admin/StudentCreator'
import { StudentNamesPanel, type StudentRow } from '@/components/admin/StudentNamesPanel'
import { StudentBulkCreator } from '@/components/admin/StudentBulkCreator'
import type { AuditEntry, City, CityProgress, Senior, SeniorMatchRow } from '@/types/app'

export const metadata = { title: 'แผงควบคุมพี่ค่าย' }

const fmt = (iso: string) =>
  new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))

export default async function AdminPage() {
  const [admin, camp] = await Promise.all([requireAdmin(), getCampState()])
  const supabase = await createClient()

  const [{ data: cities }, { data: progress }, { data: audit }, { data: studentRows }, { data: matchData }, { data: seniorData }] = await Promise.all([
    supabase.from('cities').select('*').order('id'),
    supabase.from('city_progress').select('city_id, current_seat, solved_count, last_solved_at').order('city_id'),
    supabase.from('admin_audit').select('id, action, payload, reason, created_at').order('created_at', { ascending: false }).limit(12),
    supabase.from('profiles').select('email, display_name, nickname, city_id, seat_index').eq('role', 'student')
      .order('city_id', { nullsFirst: false }).order('seat_index').order('email'),
    // ต้องรัน migration 010 ก่อน ไม่อย่างนั้นได้ null และซ่อนส่วนนี้ไว้
    supabase.rpc('admin_list_senior_matches'),
    // ทะเบียนพี่รหัส — ต้องรัน migration 016 ก่อน
    supabase.rpc('admin_list_seniors'),
  ])

  const townList = (cities ?? []) as City[]
  const rows = (progress ?? []) as CityProgress[]
  const solved = rows.reduce((s, r) => s + r.solved_count, 0)
  const { total } = await getPuzzleTotals(townList.map(c => c.id))
  const students = (studentRows ?? []) as StudentRow[]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontFamily: 'var(--display)', fontSize: '1.7rem', color: 'var(--brass-lit)', margin: '0 0 0.25rem' }}>
          แผงควบคุมพี่ค่าย
        </h1>
        <p className="stamp" style={{ margin: 0, fontSize: '0.72rem', color: 'var(--ember)' }}>
          ADMIN ONLY · ทุกการกดถูกบันทึกพร้อมชื่อผู้กด ({admin.displayName || admin.email})
        </p>
      </div>

      <div style={{ display: 'grid', gap: 18, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <OverridePanel
          unlocked={camp.decrypt_unlocked}
          mode={camp.decrypt_unlock_mode}
          solved={solved}
          total={total}
        />
        <CampControls open={camp.camp_open} opensAt={camp.opens_at} studentCount={students.length} />
        <ForceSolvePanel cities={townList} />
        <StudentCreator />
      </div>

      <PuzzleEditor cities={townList} />

      <StudentBulkCreator />

      <StudentNamesPanel students={students} />

      {Array.isArray(matchData) && (
        <SeniorMatchPanel
          rows={matchData as SeniorMatchRow[]}
          seniors={(seniorData ?? []) as Senior[]}
        />
      )}

      <section className="panel" style={{ padding: '1.4rem' }}>
        <h2 className="stamp" style={{ fontSize: '0.76rem', color: 'var(--neon)', margin: '0 0 1rem' }}>
          บันทึกการใช้สิทธิ์ · admin_audit
        </h2>
        {(audit ?? []).length === 0 ? (
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.88rem' }}>ยังไม่มีการใช้สิทธิ์</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(audit as AuditEntry[]).map(row => (
              <li key={row.id} style={{
                display: 'flex', gap: 14, flexWrap: 'wrap',
                paddingBottom: 10, borderBottom: '1px solid var(--line)', fontSize: '0.84rem',
              }}>
                <span style={{ fontFamily: 'var(--tech)', fontSize: '0.75rem', color: 'var(--muted)', minWidth: 130 }}>
                  {fmt(row.created_at)}
                </span>
                <span style={{ fontFamily: 'var(--tech)', color: 'var(--brass-lit)', minWidth: 160 }}>
                  {row.action}
                </span>
                <span style={{ flexGrow: 1, color: 'var(--muted)' }}>
                  {row.reason ?? JSON.stringify(row.payload)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
