'use client'

import { useState, useTransition } from 'react'
import { Lock, Unlock } from 'lucide-react'
import { setDecryptAction } from '@/actions/admin'
import { useConfirm } from '@/components/layout/ConfirmDialog'

export function OverridePanel({ unlocked, mode, solved, total }: {
  unlocked: boolean; mode: string | null; solved: number; total: number
}) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const confirm = useConfirm()

  async function submit(next: boolean) {
    setError(null)
    if (!reason.trim()) { setError('กรุณาระบุเหตุผล'); return }
    const ok = await confirm(next
      ? { title: 'เปิดประตูสำนักงานนายอำเภอ?', confirmLabel: 'เปิดประตู',
          message: <>น้องทุกคนจะใช้เครื่องถอดรหัสได้ทันที แม้กุญแจยังไม่ครบ ({solved}/{total})<br />เหตุผล: <strong>{reason.trim()}</strong></> }
      : { tone: 'danger', title: 'ปิดประตูกลับ?', confirmLabel: 'ปิดประตู',
          message: <>น้องที่ยังไม่ได้ถอดรหัสจะใช้เครื่องไม่ได้จนกว่าจะเปิดอีกครั้ง<br />เหตุผล: <strong>{reason.trim()}</strong></> })
    if (!ok) return
    start(async () => {
      const res = await setDecryptAction(next, reason)
      if (res.error) setError(res.error)
      else setReason('')
    })
  }

  return (
    <section className="panel" style={{
      padding: '1.4rem',
      borderColor: unlocked ? 'var(--neon)' : 'color-mix(in oklab, var(--ember) 50%, transparent)',
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <span className="stamp" style={{ fontSize: '0.72rem', color: 'var(--ember)' }}>OVERRIDE · ประตูสำนักงานนายอำเภอ</span>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ flexGrow: 1 }}>
          <div style={{ fontSize: '0.88rem', color: 'var(--muted)' }}>สถานะตอนนี้</div>
          <div style={{ fontFamily: 'var(--display)', fontSize: '1.6rem', color: unlocked ? 'var(--neon)' : 'var(--ember)' }}>
            {unlocked ? 'UNLOCKED' : 'LOCKED'}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
            {unlocked
              ? mode === 'manual' ? 'ปล่อยโดยพี่ค่าย' : 'เปิดเองเมื่อได้กุญแจครบ 6 ชิ้น'
              : `ปลดเองเมื่อครบ ${total} · ตอนนี้ ${solved}`}
          </div>
        </div>
        {unlocked
          ? <Unlock size={44} color="var(--neon)" strokeWidth={1.3} aria-hidden="true" />
          : <Lock   size={44} color="var(--ember)" strokeWidth={1.3} aria-hidden="true" />}
      </div>

      <div>
        <label htmlFor="decrypt-reason" className="label">เหตุผล (บังคับกรอก)</label>
        <input
          id="decrypt-reason" className="field" value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="เช่น เวลากิจกรรมเหลือน้อย ปล่อยก่อน"
        />
      </div>

      {error && <p role="alert" style={{ margin: 0, fontSize: '0.84rem', color: 'var(--ember)' }}>{error}</p>}

      <button
        type="button"
        className="btn-brass"
        disabled={pending}
        onClick={() => submit(!unlocked)}
        style={unlocked ? undefined : { background: 'var(--ember)', color: 'var(--on-brass)' }}
      >
        {pending ? 'กำลังทำรายการ…' : unlocked ? 'ปิดประตูกลับ' : 'เปิดประตูเดี๋ยวนี้'}
      </button>

      <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--muted)', lineHeight: 1.65 }}>
        กดแล้วทุกเครื่องที่เปิดค้างอยู่จะเห็นภายในไม่กี่วินาที และกดกลับได้ถ้าเผลอ
      </p>
    </section>
  )
}
