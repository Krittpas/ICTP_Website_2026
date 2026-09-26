'use client'

import { useEffect, useState, useTransition } from 'react'
import { assignParticipantsAction, setCampOpenAction } from '@/actions/admin'
import { useConfirm } from '@/components/layout/ConfirmDialog'

/**
 * แปลงเวลา ISO (UTC) เป็นค่าของ <input type="datetime-local"> ตามเขตเวลาเครื่องผู้ใช้
 * ห้ามตัด ISO ตรง ๆ — ช่องนี้ถือว่าค่าเป็นเวลาท้องถิ่น เวลาจะถอย 7 ชม. ทุกครั้งที่บันทึกซ้ำ
 */
function toLocalInput(iso: string) {
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

export function CampControls({ open, opensAt, studentCount }: {
  open: boolean; opensAt: string | null; studentCount: number
}) {
  // เขตเวลาของ server (UTC) ไม่ตรงกับเครื่องพี่ค่าย จึงแปลงหลัง mount ฝั่งเบราว์เซอร์เท่านั้น
  const [when, setWhen] = useState('')
  useEffect(() => { setWhen(opensAt ? toLocalInput(opensAt) : '') }, [opensAt])
  const [seed, setSeed] = useState('camp2026')
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null)
  const [pending, start] = useTransition()
  const confirm = useConfirm()

  function run(fn: () => Promise<{ ok?: true; error?: string }>, good: string) {
    setMsg(null)
    start(async () => {
      const res = await fn()
      setMsg(res.error ? { text: res.error, bad: true } : { text: good })
    })
  }

  return (
    <section className="panel" style={{ padding: '1.4rem', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <span className="stamp" style={{ fontSize: '0.72rem', color: 'var(--neon)' }}>สถานะทั้งเว็บ</span>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
        <span>เปิดให้เข้าใช้งาน</span>
        <span style={{ fontFamily: 'var(--tech)', color: open ? 'var(--neon)' : 'var(--ember)' }}>
          {open ? 'ON' : 'OFF'}
        </span>
      </div>

      <div>
        <label htmlFor="opens-at" className="label">เวลาเปิด (ใช้กับนาฬิกานับถอยหลัง)</label>
        <input id="opens-at" type="datetime-local" className="field" value={when} onChange={e => setWhen(e.target.value)} />
      </div>

      <button type="button" className="btn-ghost" disabled={pending}
        onClick={async () => {
          const ok = await confirm(open
            ? { tone: 'danger', title: 'ปิดระบบค่าย?', confirmLabel: 'ปิดระบบ',
                message: 'น้องทุกคนจะตอบปริศนาไม่ได้จนกว่าจะเปิดใหม่ ความคืบหน้าที่ทำไปแล้วยังอยู่ครบ' }
            : { title: 'เปิดระบบค่ายเดี๋ยวนี้?', confirmLabel: 'เปิดระบบ',
                message: 'หมายเลขประจำตัว #1 ของทุกเมืองจะเห็นปริศนาและเริ่มตอบได้ทันที' })
          if (ok) run(
            () => setCampOpenAction(!open, when ? new Date(when).toISOString() : null, open ? 'ปิดระบบ' : 'เปิดระบบ'),
            open ? 'ปิดระบบแล้ว' : 'เปิดระบบแล้ว',
          )
        }}>
        {open ? 'ปิดระบบ' : 'เปิดระบบเดี๋ยวนี้'}
      </button>

      <hr style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '0.3rem 0' }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
        <span>น้องค่ายในระบบ</span>
        <span style={{ fontFamily: 'var(--tech)' }}>{studentCount}</span>
      </div>

      <div>
        <label htmlFor="seed" className="label">seed สำหรับสุ่มจัดเมือง</label>
        <input id="seed" className="field" value={seed} onChange={e => setSeed(e.target.value)} />
        <p style={{ margin: '0.4rem 0 0', fontSize: '0.76rem', color: 'var(--muted)', lineHeight: 1.6 }}>
          seed เดิมให้ผลเดิมเสมอ ทวนซ้ำได้ว่าใครอยู่เมืองไหน · จัดใหม่ไม่ได้แล้วเมื่อมีคนตอบถูกไปแล้ว
        </p>
      </div>

      <button type="button" className="btn-ghost" disabled={pending}
        onClick={async () => {
          const ok = await confirm({
            title: 'สุ่มจัดน้องลง 6 เมือง?',
            message: <>ที่นั่งเดิมของน้องทุกคนจะถูกล้างแล้วจัดใหม่ด้วย seed <strong>{seed.trim() || 'camp2026'}</strong></>,
            confirmLabel: 'สุ่มจัดเมือง',
          })
          if (ok) run(() => assignParticipantsAction(seed, 'สุ่มจัดเมือง'), 'จัดเมืองเรียบร้อย')
        }}>
        สุ่มจัดน้องลง 6 เมือง
      </button>

      {msg && (
        <p role="status" style={{ margin: 0, fontSize: '0.84rem', color: msg.bad ? 'var(--ember)' : 'var(--neon)' }}>
          {msg.text}
        </p>
      )}
    </section>
  )
}
