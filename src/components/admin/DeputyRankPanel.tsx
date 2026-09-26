'use client'

import { useState, useTransition } from 'react'
import { BadgeCheck, Star } from 'lucide-react'
import { setDeputyRankAction } from '@/actions/admin'
import { DEPUTY_FALLBACK, DEPUTY_LABEL, isDeputyRank } from '@/lib/profile/titles'
import { useConfirm } from '@/components/layout/ConfirmDialog'

export interface DeputyRow {
  email: string
  display_name: string
  nickname: string
  deputy_rank: string | null
}

/**
 * ยศของพี่ค่าย — นายอำเภอกับผู้พิทักษ์ (migration 020)
 *
 * ที่นี่ตั้งได้แค่ "ยศ" ซึ่งเป็นเรื่องการแสดงผลล้วน ๆ ไม่ใช่สิทธิ์
 * ทั้งสองยศทำได้เท่ากันทุกอย่าง และฟังก์ชันฝั่งฐานข้อมูลก็แจกสิทธิ์ admin ให้ใครไม่ได้
 */
export function DeputyRankPanel({ deputies }: { deputies: DeputyRow[] }) {
  const [busy, startSave] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const confirm = useConfirm()

  async function setRank(d: DeputyRow, rank: string) {
    const label = isDeputyRank(rank) ? DEPUTY_LABEL[rank] : DEPUTY_FALLBACK
    const ok = await confirm({
      title: `ตั้ง ${d.display_name || d.email} เป็น${label}?`,
      message: <>ยศเป็นแค่คำที่แสดงบนป้ายประจำตัว ไม่ได้เพิ่มหรือลดสิทธิ์อะไรเลย</>,
      confirmLabel: 'ตั้งยศ',
    })
    if (!ok) return
    setError(null)
    setSaved(null)
    startSave(async () => {
      const res = await setDeputyRankAction(d.email, rank)
      if (res.error) setError(res.error)
      else setSaved(`${d.display_name || d.email} เป็น${label}แล้ว`)
    })
  }

  return (
    <section className="panel" style={{ padding: '1.4rem', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
        <span className="stamp" style={{ fontSize: '0.72rem', color: 'var(--neon)' }}>ยศพี่ค่าย</span>
        <span style={{ fontFamily: 'var(--tech)', fontSize: '0.8rem', color: 'var(--muted)' }}>
          {deputies.length} คน
        </span>
      </div>

      <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--muted)', lineHeight: 1.7 }}>
        พี่ค่ายไม่ใช้ฉายาคาวบอย/คาวเกิร์ล แต่ใช้ยศแทน — {DEPUTY_LABEL.sheriff} หรือ {DEPUTY_LABEL.guardian}<br />
        ยศขึ้นบนป้ายประจำตัวในเมนูโปรไฟล์ ไม่เกี่ยวกับสิทธิ์ใด ๆ
      </p>

      {error && <p role="alert" style={{ margin: 0, fontSize: '0.84rem', color: 'var(--ember)' }}>{error}</p>}
      {saved && <p role="status" style={{ margin: 0, fontSize: '0.84rem', color: 'var(--neon)' }}>✓ {saved}</p>}

      <div style={{ overflowX: 'auto' }}>
        <table className="match-table">
          <thead>
            <tr><th>ชื่อ</th><th>อีเมล</th><th>ยศตอนนี้</th><th><span className="sr-only">ตั้งยศ</span></th></tr>
          </thead>
          <tbody>
            {deputies.length === 0 && (
              <tr><td colSpan={4} style={{ color: 'var(--muted)' }}>ยังไม่มีบัญชีพี่ค่ายในระบบ</td></tr>
            )}
            {deputies.map(d => {
              const rank = isDeputyRank(d.deputy_rank) ? d.deputy_rank : null
              return (
                <tr key={d.email}>
                  <td>{d.display_name || '—'}{d.nickname && ` (${d.nickname})`}</td>
                  <td style={{ fontFamily: 'var(--tech)', fontSize: '0.8rem', color: 'var(--muted)' }}>{d.email}</td>
                  <td style={{ color: rank ? 'var(--brass-lit)' : 'var(--muted)', whiteSpace: 'nowrap' }}>
                    {rank === 'sheriff' && <Star size={13} aria-hidden="true" style={{ verticalAlign: '-2px', marginRight: 5 }} />}
                    {rank === 'guardian' && <BadgeCheck size={13} aria-hidden="true" style={{ verticalAlign: '-2px', marginRight: 5 }} />}
                    {rank ? DEPUTY_LABEL[rank] : `${DEPUTY_FALLBACK} (ยังไม่ตั้งยศ)`}
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {(['sheriff', 'guardian'] as const).map(r => (
                      <button key={r} type="button" className="btn-ghost" disabled={busy || rank === r}
                              style={{ padding: '0.35rem 0.7rem', minHeight: 34, marginLeft: 6, fontSize: '0.8rem' }}
                              onClick={() => setRank(d, r)}>
                        {DEPUTY_LABEL[r]}
                      </button>
                    ))}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
