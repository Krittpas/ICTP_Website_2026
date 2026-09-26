'use client'

import { useState, useTransition } from 'react'
import { ArrowRightLeft, UserMinus } from 'lucide-react'
import { moveStudentAction } from '@/actions/admin'
import { useConfirm } from '@/components/layout/ConfirmDialog'
import type { City } from '@/types/app'
import type { StudentRow } from './StudentNamesPanel'

const seatLabel = (city: number | null, seat: number | null) =>
  city && seat ? `เมือง ${String(city).padStart(2, '0')} · หมายเลขประจำตัว #${seat}` : 'ยังไม่มีที่นั่ง'

/**
 * ย้ายน้องรายคน (migration 017)
 *
 * "สุ่มจัดน้องลง 6 เมือง" ใช้ได้เฉพาะก่อนมีคนตอบถูกคนแรก หลังจากนั้นที่นี่คือทางเดียว
 * ที่นั่งปลายทางมีคนอยู่แล้ว ฐานข้อมูลจะสลับที่ให้ — ไม่มีใครหลุดที่นั่งโดยไม่มีใครรู้
 */
export function MoveStudentPanel({ students, cities }: { students: StudentRow[]; cities: City[] }) {
  const [email, setEmail] = useState('')
  const [cityId, setCityId] = useState<string>('')
  const [seat, setSeat] = useState<string>('')
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null)
  const [pending, start] = useTransition()
  const confirm = useConfirm()

  const who = students.find(s => s.email === email.trim().toLowerCase())
  const target = students.find(s =>
    cityId && seat && s.city_id === Number(cityId) && s.seat_index === Number(seat))

  function run(nextCity: number | null, nextSeat: number | null, reason: string) {
    setMsg(null)
    start(async () => {
      const res = await moveStudentAction(email, nextCity, nextSeat, reason)
      setMsg(res.error ? { text: res.error, bad: true } : { text: res.message ?? 'ย้ายแล้ว' })
      if (!res.error) { setCityId(''); setSeat('') }
    })
  }

  async function move() {
    if (!email.trim()) { setMsg({ text: 'เลือกน้องที่จะย้ายก่อน', bad: true }); return }
    if (!cityId || !seat) { setMsg({ text: 'เลือกเมืองและที่นั่งปลายทาง', bad: true }); return }

    const name = who?.display_name || email.trim()
    const ok = await confirm({
      title: `ย้าย ${name} ไปเมือง ${String(Number(cityId)).padStart(2, '0')} หมายเลขประจำตัว #${seat}?`,
      confirmLabel: 'ย้าย',
      message: target
        ? <>ที่นั่งนี้มี <strong>{target.display_name || target.email}</strong> อยู่ — ทั้งสองคนจะ<strong>สลับที่กัน</strong>
            {!who?.city_id && <><br />แต่ {name} ยังไม่มีที่นั่งเดิม คนที่ถูกสลับจะหลุดออกไปไม่มีที่นั่ง ต้องจัดที่ให้ใหม่</>}</>
        : <>ที่นั่งปลายทางยังว่างอยู่ · ที่นั่งเดิมของ {name} ({seatLabel(who?.city_id ?? null, who?.seat_index ?? null)}) จะว่างลง</>,
    })
    if (ok) run(Number(cityId), Number(seat), 'ย้ายน้องรายคน')
  }

  async function unseat() {
    if (!who) { setMsg({ text: 'เลือกน้องที่จะเอาออกก่อน', bad: true }); return }
    const ok = await confirm({
      tone: 'danger',
      title: `เอา ${who.display_name || who.email} ออกจากที่นั่ง?`,
      confirmLabel: 'เอาออกจากที่นั่ง',
      message: <>บัญชียังอยู่ครบ แต่จะไม่มีปริศนาให้ทำจนกว่าจะจัดที่ให้ใหม่<br />
                 ที่นั่ง {seatLabel(who.city_id, who.seat_index)} จะว่างลง — อย่าลืม<strong>ปิดที่นั่ง</strong>นั้นถ้าไม่มีคนมาแทน
                 ไม่อย่างนั้นโซ่ทั้งเมืองจะค้าง</>,
    })
    if (ok) run(null, null, 'เอาน้องออกจากที่นั่ง')
  }

  return (
    <section className="panel" style={{ padding: '1.4rem', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <span className="stamp" style={{ fontSize: '0.72rem', color: 'var(--neon)' }}>ย้ายน้องรายคน</span>

      <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--muted)', lineHeight: 1.7 }}>
        ใช้ได้ตลอดเวลา แม้ค่ายเริ่มไปแล้ว · ที่นั่งปลายทางมีคนอยู่ = สลับที่กันให้เอง
      </p>

      <div>
        <label htmlFor="mv-email" className="label">น้องที่จะย้าย</label>
        <input id="mv-email" list="mv-students" className="field" autoComplete="off"
               value={email} onChange={e => setEmail(e.target.value)}
               placeholder="s12345@bj.ac.th" style={{ fontFamily: 'var(--tech)' }} />
        <datalist id="mv-students">
          {students.map(s => (
            <option key={s.email} value={s.email}>
              {s.display_name} · {seatLabel(s.city_id, s.seat_index)}
            </option>
          ))}
        </datalist>
        {who && (
          <p style={{ margin: '0.4rem 0 0', fontSize: '0.8rem', color: 'var(--muted)' }}>
            ตอนนี้อยู่ {seatLabel(who.city_id, who.seat_index)}
          </p>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flexGrow: 1, minWidth: 150 }}>
          <label htmlFor="mv-city" className="label">ย้ายไปเมือง</label>
          <select id="mv-city" className="field" value={cityId} onChange={e => setCityId(e.target.value)}>
            <option value="">— เลือกเมือง —</option>
            {cities.map(c => (
              <option key={c.id} value={c.id}>{String(c.id).padStart(2, '0')} · {c.name_en}</option>
            ))}
          </select>
        </div>
        <div style={{ width: 150 }}>
          <label htmlFor="mv-seat" className="label">ที่นั่ง</label>
          <select id="mv-seat" className="field" value={seat} onChange={e => setSeat(e.target.value)}>
            <option value="">— เลือก —</option>
            {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>หมายเลขประจำตัว #{n}</option>)}
          </select>
        </div>
      </div>

      {target && (
        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--brass-lit)', lineHeight: 1.7 }}>
          ที่นั่งนี้มี {target.display_name || target.email} อยู่ — กดย้ายแล้วจะสลับที่กัน
        </p>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" className="btn-brass" disabled={pending} onClick={move}>
          <ArrowRightLeft size={15} aria-hidden="true" /> {pending ? 'กำลังย้าย…' : 'ย้ายที่นั่ง'}
        </button>
        <button type="button" className="btn-ghost" disabled={pending || !who?.city_id} onClick={unseat}>
          <UserMinus size={15} aria-hidden="true" /> เอาออกจากที่นั่ง
        </button>
      </div>

      {msg && (
        <p role="status" style={{ margin: 0, fontSize: '0.84rem', lineHeight: 1.7, color: msg.bad ? 'var(--ember)' : 'var(--neon)' }}>
          {msg.text}
        </p>
      )}
    </section>
  )
}
