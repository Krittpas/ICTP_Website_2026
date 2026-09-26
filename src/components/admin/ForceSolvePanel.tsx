'use client'

import { useState, useTransition } from 'react'
import { forceSolveSeatAction } from '@/actions/admin'
import { useConfirm } from '@/components/layout/ConfirmDialog'
import type { City } from '@/types/app'

/**
 * ปลดที่นั่งที่ค้าง
 *
 * โซ่ลูกโซ่แปลว่าถ้าคนที่ 3 ไม่มา อีก 3 คนหลังในเมืองนั้นทำอะไรไม่ได้เลย
 * ปุ่มนี้จึงต้องมีตั้งแต่วันแรก ไม่ใช่ทำทีหลัง
 */
export function ForceSolvePanel({ cities }: { cities: City[] }) {
  const [cityId, setCityId] = useState(cities[0]?.id ?? 1)
  const [seat, setSeat] = useState(1)
  const [reason, setReason] = useState('')
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null)
  const [pending, start] = useTransition()
  const confirm = useConfirm()

  async function submit() {
    setMsg(null)
    if (!reason.trim()) { setMsg({ text: 'กรุณาระบุเหตุผล', bad: true }); return }
    const city = cities.find(c => c.id === cityId)
    const ok = await confirm({
      title: `ปลดหมายเลขประจำตัว #${seat} ของ ${city?.name_en ?? `เมือง ${cityId}`}?`,
      message: <>ที่นั่งนี้จะถูกนับว่าผ่านแล้ว และคนถัดไปในเมืองเริ่มตอบได้ทันที ย้อนกลับไม่ได้<br />เหตุผล: <strong>{reason.trim()}</strong></>,
      confirmLabel: 'ปลดที่นั่ง',
    })
    if (!ok) return
    start(async () => {
      const res = await forceSolveSeatAction(cityId, seat, reason)
      if (res.error) setMsg({ text: res.error, bad: true })
      else { setMsg({ text: 'ปลดที่นั่งแล้ว โซ่เดินต่อได้' }); setReason('') }
    })
  }

  return (
    <section className="panel" style={{ padding: '1.4rem', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <span className="stamp" style={{ fontSize: '0.72rem', color: 'var(--brass)' }}>ปลดที่นั่งที่ค้าง</span>

      <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--muted)', lineHeight: 1.7 }}>
        ถ้าน้องคนหนึ่งไม่มาหรือเข้าระบบไม่ได้ อีก 5 คนหลังในเมืองนั้นจะติดทั้งเมือง
      </p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flexGrow: 1, minWidth: 140 }}>
          <label htmlFor="fs-city" className="label">เมือง</label>
          <select id="fs-city" className="field" value={cityId} onChange={e => setCityId(Number(e.target.value))}>
            {cities.map(c => (
              <option key={c.id} value={c.id}>{String(c.id).padStart(2, '0')} · {c.name_en}</option>
            ))}
          </select>
        </div>
        <div style={{ width: 120 }}>
          <label htmlFor="fs-seat" className="label">ที่นั่ง</label>
          <select id="fs-seat" className="field" value={seat} onChange={e => setSeat(Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>ที่นั่ง {n}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="fs-reason" className="label">เหตุผล (บังคับกรอก)</label>
        <input id="fs-reason" className="field" value={reason} onChange={e => setReason(e.target.value)}
               placeholder="เช่น น้องไม่มาวันนี้" />
      </div>

      <button type="button" className="btn-ghost" disabled={pending} onClick={submit}>
        {pending ? 'กำลังทำรายการ…' : 'ทำเครื่องหมายว่าผ่าน แล้วเลื่อนโซ่'}
      </button>

      {msg && (
        <p role="status" style={{ margin: 0, fontSize: '0.84rem', color: msg.bad ? 'var(--ember)' : 'var(--neon)' }}>
          {msg.text}
        </p>
      )}

      <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--muted)', lineHeight: 1.6 }}>
        บันทึกเป็น via = &apos;admin&apos; เพื่อให้สถิติหลังค่ายแยกออกจากคนที่ตอบเอง
      </p>
    </section>
  )
}
