'use client'

import { useActionState, useEffect, useState, useTransition } from 'react'
import { Pencil, Trash2, UserPlus } from 'lucide-react'
import {
  assignSeniorAction,
  deleteSeniorAction,
  deleteSeniorMatchAction,
  upsertSeniorAction,
  upsertSeniorMatchesAction,
} from '@/actions/admin'
import type { Senior, SeniorMatchRow } from '@/types/app'
import { useConfirm } from '@/components/layout/ConfirmDialog'

type State = { ok?: true; error?: string; message?: string } | null

const EMPTY_SENIOR = { id: '', name: '', nickname: '', clue: '' }

/**
 * จับคู่พี่รหัส — สองขั้นตอนที่แยกกันชัด ๆ
 *
 *   1. ทะเบียนพี่รหัส — ชื่อ ชื่อเล่น และ "คำใบ้" อยู่ที่พี่ (migration 016)
 *      พี่หนึ่งคนมีน้องได้หลายคน แก้คำใบ้ครั้งเดียว น้องทุกคนของพี่คนนั้นเห็นตรงกัน
 *   2. จับคู่น้อง — เลือกน้องแล้วเลือกว่าเป็นของพี่คนไหน
 *
 * น้องแต่ละคนจะเห็นข้อมูลนี้เมื่อนำรหัสลับของตัวเองมาใส่เครื่องถอดรหัส
 */
export function SeniorMatchPanel({ rows, seniors }: { rows: SeniorMatchRow[]; seniors: Senior[] }) {
  const [senior, seniorAction, seniorPending] = useActionState<State, FormData>(upsertSeniorAction, null)
  const [assign, assignAction, assignPending] = useActionState<State, FormData>(assignSeniorAction, null)
  const [bulk, bulkAction, bulkPending] = useActionState<State, FormData>(upsertSeniorMatchesAction, null)

  const [form, setForm] = useState(EMPTY_SENIOR)
  const [pair, setPair] = useState({ email: '', seniorId: '' })
  const [delError, setDelError] = useState<string | null>(null)
  const [deleting, startDelete] = useTransition()
  const confirm = useConfirm()

  // บันทึกสำเร็จแล้วล้างฟอร์ม พร้อมกรอกคนถัดไป
  useEffect(() => { if (senior?.ok) setForm(EMPTY_SENIOR) }, [senior])
  useEffect(() => { if (assign?.ok) setPair(p => ({ email: '', seniorId: p.seniorId })) }, [assign])

  const students = rows.filter(r => r.has_account)
  const matched = rows.filter(r => r.senior_id).length
  const revealed = rows.filter(r => r.revealed_at).length

  const setField = (k: keyof typeof EMPTY_SENIOR) =>
    (e: { target: { value: string } }) => setForm(f => ({ ...f, [k]: e.target.value }))

  function editSenior(s: Senior) {
    setForm({ id: String(s.id), name: s.name, nickname: s.nickname, clue: s.clue })
    document.getElementById('sm-name')?.focus()
  }

  function editPair(r: SeniorMatchRow) {
    setPair({ email: r.email, seniorId: r.senior_id ? String(r.senior_id) : '' })
    document.getElementById('sm-pair-senior')?.focus()
  }

  async function removeSenior(s: Senior) {
    const ok = await confirm({
      tone: 'danger',
      title: `ลบพี่รหัส ${s.name}?`,
      message: s.assigned > 0
        ? <>พี่คนนี้ยังมีน้องผูกอยู่ <strong>{s.assigned} คน</strong> ต้องย้ายน้องไปพี่คนอื่นก่อนจึงจะลบได้</>
        : <>ชื่อและคำใบ้ของพี่คนนี้จะถูกลบ เพิ่มใหม่ได้ภายหลัง</>,
      confirmLabel: 'ลบ',
    })
    if (!ok) return
    setDelError(null)
    startDelete(async () => {
      const res = await deleteSeniorAction(s.id)
      if (res.error) setDelError(res.error)
      else if (form.id === String(s.id)) setForm(EMPTY_SENIOR)
    })
  }

  /** เอาน้องออกจากพี่ — ต้องมี ไม่อย่างนั้นพี่ที่ยังมีน้องผูกอยู่จะลบไม่ได้เลย */
  async function unpair(r: SeniorMatchRow) {
    const ok = await confirm({
      tone: 'danger',
      title: 'เอาน้องคนนี้ออกจากพี่รหัส?',
      message: <><strong>{r.display_name || r.email}</strong> จะกลับไปเป็น &quot;ยังไม่จับคู่&quot;
                 และใช้เครื่องถอดรหัสไม่ได้จนกว่าจะจับคู่ใหม่</>,
      confirmLabel: 'เอาออก',
    })
    if (!ok) return
    setDelError(null)
    startDelete(async () => {
      const res = await deleteSeniorMatchAction(r.email)
      if (res.error) setDelError(res.error)
    })
  }

  return (
    <section className="panel" style={{ padding: '1.4rem', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
        <span className="stamp" style={{ fontSize: '0.72rem', color: 'var(--neon)' }}>จับคู่พี่รหัส · เครื่องถอดรหัส</span>
        <span style={{ fontFamily: 'var(--tech)', fontSize: '0.8rem', color: 'var(--muted)' }}>
          พี่ {seniors.length} คน · จับคู่แล้ว {matched} / {students.length} · เปิดเผยแล้ว {revealed}
        </span>
      </div>

      <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--muted)', lineHeight: 1.7 }}>
        คำใบ้ผูกอยู่กับ<strong style={{ color: 'var(--text)' }}>พี่รหัส</strong> ไม่ใช่น้อง —
        เลือกพี่แล้วใส่คำใบ้ครั้งเดียว น้องทุกคนของพี่คนนั้นเห็นข้อความเดียวกัน
      </p>

      {/* ══ 1. ทะเบียนพี่รหัส ══ */}
      <div className="senior-step">
        <h3 className="senior-step-title"><span aria-hidden="true">1</span> ทะเบียนพี่รหัส</h3>

        <form action={seniorAction} style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <input type="hidden" name="senior_id" value={form.id} />
          <div>
            <label htmlFor="sm-name" className="label">ชื่อพี่รหัส</label>
            <input id="sm-name" name="name" required maxLength={100} className="field"
                   value={form.name} onChange={setField('name')} placeholder="ชื่อ-นามสกุล" />
          </div>
          <div>
            <label htmlFor="sm-nick" className="label">ชื่อเล่นพี่</label>
            <input id="sm-nick" name="nickname" maxLength={50} className="field"
                   value={form.nickname} onChange={setField('nickname')} placeholder="เช่น มิว" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            {/* คนละอันกับ "คำใบ้" ในคลังปริศนา — อันนั้นช่วยไขโจทย์ อันนี้ช่วยตามหาตัวพี่ */}
            <label htmlFor="sm-clue" className="label">
              คำใบ้ตามหาพี่ (ไม่บังคับ · น้องเห็นเป็น “เบาะแส” บนการ์ดพี่รหัส · น้องทุกคนของพี่คนนี้เห็นเหมือนกัน)
            </label>
            <textarea id="sm-clue" name="clue" rows={2} maxLength={1000} className="field" style={{ resize: 'vertical' }}
                      value={form.clue} onChange={setField('clue')}
                      placeholder="เช่น พี่รออยู่หน้าห้อง ICTP ถือป้ายรูปหมวกคาวบอย" />
          </div>
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="submit" className="btn-brass" disabled={seniorPending}>
              {seniorPending ? 'กำลังบันทึก…' : form.id ? 'บันทึกการแก้ไข' : 'เพิ่มพี่รหัส'}
            </button>
            {(form.id || form.name || form.clue) && (
              <button type="button" className="btn-ghost" onClick={() => setForm(EMPTY_SENIOR)}>
                {form.id ? 'ยกเลิกการแก้ไข' : 'ล้างฟอร์ม'}
              </button>
            )}
            <Status state={senior} />
          </div>
        </form>

        {delError && <p role="alert" style={{ margin: '0.6rem 0 0', fontSize: '0.84rem', color: 'var(--ember)' }}>{delError}</p>}

        <div style={{ overflowX: 'auto', marginTop: 12 }}>
          <table className="match-table">
            <thead>
              <tr><th>พี่รหัส</th><th>คำใบ้ตามหาพี่</th><th>น้อง</th><th><span className="sr-only">จัดการ</span></th></tr>
            </thead>
            <tbody>
              {seniors.length === 0 && (
                <tr><td colSpan={4} style={{ color: 'var(--muted)' }}>ยังไม่มีพี่รหัสในระบบ — เพิ่มจากฟอร์มด้านบน</td></tr>
              )}
              {seniors.map(s => (
                <tr key={s.id}>
                  <td>
                    <div>{s.name}</div>
                    {s.nickname && <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>พี่{s.nickname}</div>}
                  </td>
                  <td className="clue-cell" title={s.clue || undefined}>
                    {s.clue || <span style={{ color: 'var(--muted)' }}>— ยังไม่ใส่คำใบ้ —</span>}
                  </td>
                  <td style={{ fontFamily: 'var(--tech)', whiteSpace: 'nowrap' }}>
                    {s.assigned} คน
                    {s.revealed > 0 && <span style={{ color: 'var(--neon)' }}> · เปิดแล้ว {s.revealed}</span>}
                  </td>
                  <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                    <button type="button" className="icon-btn" style={{ width: 36, height: 36 }}
                            aria-label={`แก้พี่รหัส ${s.name}`} onClick={() => editSenior(s)}>
                      <Pencil size={14} />
                    </button>
                    <button type="button" className="icon-btn" style={{ width: 36, height: 36, marginLeft: 6, color: 'var(--ember)' }}
                            disabled={deleting} aria-label={`ลบพี่รหัส ${s.name}`} onClick={() => removeSenior(s)}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ══ 2. จับคู่น้องเข้ากับพี่ ══ */}
      <div className="senior-step">
        <h3 className="senior-step-title"><span aria-hidden="true">2</span> จับคู่น้องเข้ากับพี่</h3>

        {seniors.length === 0 ? (
          <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--muted)' }}>
            เพิ่มพี่รหัสอย่างน้อยหนึ่งคนก่อน จึงจะจับคู่น้องได้
          </p>
        ) : (
          <form action={assignAction} style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
            <div>
              <label htmlFor="sm-pair-email" className="label">อีเมลน้อง</label>
              <input id="sm-pair-email" name="email" list="sm-students" required className="field" autoComplete="off"
                     value={pair.email} onChange={e => setPair(p => ({ ...p, email: e.target.value }))}
                     placeholder="s12345@bj.ac.th" style={{ fontFamily: 'var(--tech)' }} />
              <datalist id="sm-students">
                {students.map(s => <option key={s.email} value={s.email}>{s.display_name}</option>)}
              </datalist>
            </div>
            <div>
              <label htmlFor="sm-pair-senior" className="label">พี่รหัส</label>
              <select id="sm-pair-senior" name="senior_id" required className="field"
                      value={pair.seniorId} onChange={e => setPair(p => ({ ...p, seniorId: e.target.value }))}>
                <option value="">— เลือกพี่รหัส —</option>
                {seniors.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}{s.nickname ? ` (${s.nickname})` : ''} · น้อง {s.assigned} คน
                  </option>
                ))}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <button type="submit" className="btn-brass" disabled={assignPending}>
                <UserPlus size={15} aria-hidden="true" /> {assignPending ? 'กำลังจับคู่…' : 'จับคู่'}
              </button>
              <Status state={assign} />
            </div>
          </form>
        )}

        {/* ── หลายคนจากสเปรดชีต ── */}
        <details style={{ marginTop: 14 }}>
          <summary style={{ cursor: 'pointer', fontSize: '0.9rem', color: 'var(--brass-lit)' }}>วางหลายคนจากสเปรดชีต</summary>
          <form action={bulkAction} style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--muted)', lineHeight: 1.7 }}>
              หนึ่งบรรทัดต่อหนึ่งคน เรียงคอลัมน์ <span style={{ fontFamily: 'var(--tech)' }}>อีเมลน้อง | ชื่อพี่ | ชื่อเล่นพี่ | คำใบ้</span><br />
              พี่ที่ยังไม่มีในทะเบียนจะถูกเพิ่มให้เอง · ช่องคำใบ้ว่าง = ไม่แตะคำใบ้เดิมของพี่<br />
              คัดลอกจาก Google Sheets มาวางได้เลย หรือคั่นด้วยจุลภาค · มีแถวผิดแม้แถวเดียว = ไม่บันทึกทั้งก้อน
            </p>
            <textarea name="bulk" rows={6} required className="field"
                      style={{ fontFamily: 'var(--tech)', fontSize: '0.85rem', resize: 'vertical' }}
                      placeholder={'s12345@bj.ac.th\tสมชาย ใจดี\tชาย\tพี่รออยู่ที่โรงอาหาร'} />
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <button type="submit" className="btn-ghost" disabled={bulkPending}>
                {bulkPending ? 'กำลังบันทึก…' : 'บันทึกทั้งหมด'}
              </button>
              <Status state={bulk} />
            </div>
          </form>
        </details>
      </div>

      {/* ══ รายชื่อน้องกับพี่ที่จับคู่ไว้ ══ */}
      <div style={{ overflowX: 'auto' }}>
        <table className="match-table">
          <thead>
            <tr><th>เมือง · #</th><th>น้อง</th><th>พี่รหัส</th><th>สถานะ</th><th><span className="sr-only">จัดการ</span></th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={5} style={{ color: 'var(--muted)' }}>ยังไม่มีน้องค่ายในระบบ</td></tr>
            )}
            {rows.map(r => (
              <tr key={r.email}>
                <td style={{ fontFamily: 'var(--tech)' }}>
                  {r.city_id ? `${String(r.city_id).padStart(2, '0')} · #${r.seat_index}` : '—'}
                </td>
                <td>
                  <div>{r.display_name || <span style={{ color: 'var(--muted)' }}>—</span>}</div>
                  <div style={{ fontFamily: 'var(--tech)', fontSize: '0.74rem', color: 'var(--muted)' }}>{r.email}</div>
                </td>
                <td>
                  {r.senior_name
                    ? <>{r.senior_name}{r.senior_nickname && <span style={{ color: 'var(--muted)' }}> ({r.senior_nickname})</span>}</>
                    : <span style={{ color: 'var(--muted)' }}>—</span>}
                </td>
                <td><Badge row={r} /></td>
                <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                  <button type="button" className="icon-btn" style={{ width: 36, height: 36 }}
                          aria-label={`เปลี่ยนพี่รหัสของ ${r.display_name || r.email}`} onClick={() => editPair(r)}>
                    <Pencil size={14} />
                  </button>
                  {r.senior_id && (
                    <button type="button" className="icon-btn" style={{ width: 36, height: 36, marginLeft: 6, color: 'var(--ember)' }}
                            disabled={deleting} aria-label={`เอา ${r.display_name || r.email} ออกจากพี่รหัส`}
                            onClick={() => unpair(r)}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
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

function Badge({ row }: { row: SeniorMatchRow }) {
  const [text, color] =
    !row.has_account  ? ['ยังไม่มีบัญชีอีเมลนี้', 'var(--ember)']
    : row.revealed_at ? ['✓ เปิดเผยแล้ว', 'var(--neon)']
    : row.senior_id   ? ['จับคู่แล้ว', 'var(--brass-lit)']
    :                   ['ยังไม่จับคู่', 'var(--muted)']
  return <span style={{ fontSize: '0.8rem', color, whiteSpace: 'nowrap' }}>{text}</span>
}
