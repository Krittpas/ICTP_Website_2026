'use client'

import { useActionState, useEffect, useState, useTransition } from 'react'
import { Check, Copy, KeyRound, Pencil } from 'lucide-react'
import { resetStudentPasswordAction, setStudentNamesAction } from '@/actions/admin'
import { NAME_RULE, THAI_FULL_NAME, THAI_NICKNAME } from '@/lib/profile/names'
import { COWHAND_LABEL, GRADES, cowhandTitle, generationOf, isCowhand } from '@/lib/profile/titles'
import { useConfirm } from '@/components/layout/ConfirmDialog'

type State = { ok?: true; error?: string; message?: string } | null

export interface StudentRow {
  email: string
  display_name: string
  nickname: string
  city_id: number | null
  seat_index: number | null
  /** คาวบอย/คาวเกิร์ล — ยังไม่ได้ตั้งเป็น null (migration 020) */
  cowhand: string | null
  /** ชั้น ม.4–6 · เลขรุ่นคำนวณจากตรงนี้ */
  grade: number | null
}

const EMPTY = { email: '', name: '', nickname: '', cowhand: '', grade: '' }

/**
 * รายชื่อน้องค่าย — ชื่อ-นามสกุลและชื่อเล่นภาษาไทย ตั้งโดยพี่ค่ายเท่านั้น
 * บัญชีที่ชื่อยังไม่ใช่ภาษาไทย (เช่นยังเป็นรหัสนักเรียน) ขึ้นป้าย "ต้องแก้" ให้เห็นทันที
 */
export function StudentNamesPanel({ students }: { students: StudentRow[] }) {
  const [one, oneAction, onePending] = useActionState<State, FormData>(setStudentNamesAction, null)
  const [bulk, bulkAction, bulkPending] = useActionState<State, FormData>(setStudentNamesAction, null)
  const [form, setForm] = useState(EMPTY)
  const [issued, setIssued] = useState<{ email: string; password: string } | null>(null)
  const [resetError, setResetError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [resetting, startReset] = useTransition()
  const confirm = useConfirm()

  useEffect(() => { if (one?.ok) setForm(EMPTY) }, [one])

  async function resetPassword(s: StudentRow) {
    const ok = await confirm({
      title: 'ออกรหัสผ่านใหม่?',
      message: <>รหัสเดิมของ <strong>{s.display_name || s.email}</strong> จะใช้ไม่ได้ทันที
                รหัสใหม่แสดงครั้งเดียว ต้องจดไปแจกน้องเอง</>,
      confirmLabel: 'ออกรหัสใหม่',
    })
    if (!ok) return
    setResetError(null)
    setIssued(null)
    setCopied(false)
    startReset(async () => {
      const res = await resetStudentPasswordAction(s.email)
      if (res.error || !res.password) setResetError(res.error ?? 'ออกรหัสผ่านใหม่ไม่สำเร็จ')
      else setIssued({ email: s.email, password: res.password })
    })
  }

  async function copyIssued() {
    if (!issued) return
    try {
      await navigator.clipboard.writeText(`${issued.email}	${issued.password}`)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  const needsFix = (s: StudentRow) =>
    !THAI_FULL_NAME.test(s.display_name) || !THAI_NICKNAME.test(s.nickname)
    || !isCowhand(s.cowhand) || !generationOf(s.grade)
  const pending = students.filter(needsFix).length
  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => setForm(f => ({ ...f, [k]: e.target.value }))

  function edit(s: StudentRow) {
    setForm({
      email: s.email,
      name: THAI_FULL_NAME.test(s.display_name) ? s.display_name : '',
      nickname: THAI_NICKNAME.test(s.nickname) ? s.nickname : '',
      cowhand: isCowhand(s.cowhand) ? s.cowhand : '',
      grade: s.grade ? String(s.grade) : '',
    })
    document.getElementById('sn-name')?.focus()
  }

  return (
    <section className="panel" style={{ padding: '1.4rem', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
        <span className="stamp" style={{ fontSize: '0.72rem', color: 'var(--neon)' }}>รายชื่อน้องค่าย</span>
        <span style={{ fontFamily: 'var(--tech)', fontSize: '0.8rem', color: pending ? 'var(--ember)' : 'var(--muted)' }}>
          {students.length} คน{pending ? ` · ยังไม่ครบ ${pending} คน` : ' · ชื่อและฉายาครบทุกคน'}
        </span>
      </div>

      <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--muted)', lineHeight: 1.7 }}>
        น้องแก้ชื่อและฉายาเองไม่ได้ เปลี่ยนได้แค่รูปโปรไฟล์ · {NAME_RULE}<br />
        เลขรุ่นคำนวณจากชั้นเรียนให้เอง — ม.6 คือรุ่น {generationOf(6)} · ม.5 รุ่น {generationOf(5)} · ม.4 รุ่น {generationOf(4)}
      </p>

      {/* ── ทีละคน ── */}
      <form action={oneAction} style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
        <div>
          <label htmlFor="sn-email" className="label">อีเมลน้อง</label>
          <input id="sn-email" name="email" list="sn-students" required className="field" autoComplete="off"
                 value={form.email} onChange={set('email')} placeholder="s12345@bj.ac.th" style={{ fontFamily: 'var(--tech)' }} />
          <datalist id="sn-students">
            {students.map(s => <option key={s.email} value={s.email}>{s.display_name}</option>)}
          </datalist>
        </div>
        <div>
          <label htmlFor="sn-name" className="label">ชื่อ-นามสกุล</label>
          <input id="sn-name" name="name" required maxLength={100} className="field"
                 value={form.name} onChange={set('name')} placeholder="เช่น สมชาย ใจดี" />
        </div>
        <div>
          <label htmlFor="sn-nick" className="label">ชื่อเล่น</label>
          <input id="sn-nick" name="nickname" required maxLength={30} className="field"
                 value={form.nickname} onChange={set('nickname')} placeholder="เช่น เอก" />
        </div>
        <div>
          <label htmlFor="sn-cowhand" className="label">ฉายา</label>
          <select id="sn-cowhand" name="cowhand" className="field"
                  value={form.cowhand} onChange={set('cowhand')}>
            <option value="">— ไม่เปลี่ยน —</option>
            <option value="cowboy">{COWHAND_LABEL.cowboy}</option>
            <option value="cowgirl">{COWHAND_LABEL.cowgirl}</option>
          </select>
        </div>
        <div>
          <label htmlFor="sn-grade" className="label">ชั้น</label>
          <select id="sn-grade" name="grade" className="field"
                  value={form.grade} onChange={set('grade')}>
            <option value="">— ไม่เปลี่ยน —</option>
            {GRADES.map(g => (
              <option key={g} value={g}>ม.{g} · รุ่น {generationOf(g)}</option>
            ))}
          </select>
        </div>
        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="submit" className="btn-brass" disabled={onePending}>
            {onePending ? 'กำลังบันทึก…' : 'บันทึกชื่อ'}
          </button>
          <Status state={one} />
        </div>
      </form>

      {/* ── หลายคนจากสเปรดชีต ── */}
      <details>
        <summary style={{ cursor: 'pointer', fontSize: '0.9rem', color: 'var(--brass-lit)' }}>วางหลายคนจากสเปรดชีต</summary>
        <form action={bulkAction} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--muted)', lineHeight: 1.7 }}>
            หนึ่งบรรทัดต่อหนึ่งคน เรียงคอลัมน์{' '}
            <span style={{ fontFamily: 'var(--tech)' }}>อีเมลน้อง | ชื่อ-นามสกุล | ชื่อเล่น | คาวบอย/คาวเกิร์ล | ชั้น</span><br />
            สองช่องท้ายเว้นว่างได้ = ฉายาเดิมไม่ถูกแตะ · ชั้นใส่ &quot;5&quot; หรือ &quot;ม.5&quot; ก็ได้<br />
            คัดลอกจาก Google Sheets มาวางได้เลย · มีแถวผิดแม้แถวเดียว = ไม่บันทึกทั้งก้อน
          </p>
          <textarea name="bulk" rows={6} required className="field"
                    style={{ fontFamily: 'var(--tech)', fontSize: '0.85rem', resize: 'vertical' }}
                    placeholder={'s12345@bj.ac.th\tสมชาย ใจดี\tเอก'} />
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="submit" className="btn-ghost" disabled={bulkPending}>
              {bulkPending ? 'กำลังบันทึก…' : 'บันทึกทั้งหมด'}
            </button>
            <Status state={bulk} />
          </div>
        </form>
      </details>

      {/* ── รหัสผ่านใหม่ที่เพิ่งออก ── */}
      {resetError && <p role="alert" style={{ margin: 0, fontSize: '0.84rem', color: 'var(--ember)' }}>{resetError}</p>}
      {issued && (
        <div role="status" style={{
          padding: '0.9rem 1rem', borderRadius: 8,
          background: 'var(--plank-2)', border: '1px solid var(--neon)',
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
            รหัสผ่านใหม่ของ {issued.email} — แสดงครั้งเดียว จดก่อนปิดหน้านี้
          </span>
          <span style={{ fontFamily: 'var(--tech)', fontSize: '1.3rem', letterSpacing: '0.08em', color: 'var(--neon)' }}>
            {issued.password}
          </span>
          <button type="button" className="btn-ghost" onClick={copyIssued}
                  style={{ alignSelf: 'flex-start', padding: '0.4rem 0.8rem', minHeight: 36 }}>
            {copied ? <><Check size={13} aria-hidden="true" /> คัดลอกแล้ว</> : <><Copy size={13} aria-hidden="true" /> คัดลอก</>}
          </button>
        </div>
      )}

      {/* ── รายชื่อ ── */}
      <div style={{ overflowX: 'auto' }}>
        <table className="match-table">
          <thead>
            <tr><th>เมือง · #</th><th>อีเมล</th><th>ชื่อ-นามสกุล</th><th>ชื่อเล่น</th><th>ฉายา</th><th><span className="sr-only">จัดการ</span></th></tr>
          </thead>
          <tbody>
            {students.length === 0 && (
              <tr><td colSpan={6} style={{ color: 'var(--muted)' }}>ยังไม่มีน้องค่ายในระบบ</td></tr>
            )}
            {students.map(s => {
              const nameOk = THAI_FULL_NAME.test(s.display_name)
              const nickOk = THAI_NICKNAME.test(s.nickname)
              const titleOk = isCowhand(s.cowhand) && !!generationOf(s.grade)
              return (
                <tr key={s.email}>
                  <td style={{ fontFamily: 'var(--tech)' }}>
                    {s.city_id ? `${String(s.city_id).padStart(2, '0')} · #${s.seat_index}` : '—'}
                  </td>
                  <td style={{ fontFamily: 'var(--tech)', fontSize: '0.8rem', color: 'var(--muted)' }}>{s.email}</td>
                  <td style={{ color: nameOk ? undefined : 'var(--ember)' }}>
                    {s.display_name || '—'}{!nameOk && <span className="needs-fix">ต้องแก้</span>}
                  </td>
                  <td style={{ color: nickOk ? undefined : 'var(--ember)' }}>
                    {s.nickname || '—'}{!nickOk && <span className="needs-fix">ต้องแก้</span>}
                  </td>
                  <td style={{ color: titleOk ? 'var(--brass-lit)' : 'var(--ember)', whiteSpace: 'nowrap' }}>
                    {titleOk ? cowhandTitle(s.cowhand, s.grade) : <>ยังไม่ตั้ง<span className="needs-fix">ต้องแก้</span></>}
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button type="button" className="icon-btn" style={{ width: 36, height: 36 }}
                            aria-label={`แก้ชื่อและฉายาของ ${s.email}`} onClick={() => edit(s)}>
                      <Pencil size={14} />
                    </button>
                    <button type="button" className="icon-btn" style={{ width: 36, height: 36, marginLeft: 6 }}
                            disabled={resetting} aria-label={`ออกรหัสผ่านใหม่ให้ ${s.email}`}
                            title="ออกรหัสผ่านใหม่" onClick={() => resetPassword(s)}>
                      <KeyRound size={14} />
                    </button>
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

function Status({ state }: { state: State }) {
  if (state?.error) return <span role="alert" style={{ fontSize: '0.84rem', color: 'var(--ember)' }}>{state.error}</span>
  if (state?.ok) return <span role="status" style={{ fontSize: '0.84rem', color: 'var(--neon)' }}>✓ {state.message ?? 'บันทึกแล้ว'}</span>
  return null
}
