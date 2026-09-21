import { CircleCheck, Clock, UserX } from 'lucide-react'
import type { CityStatus } from '@/types/app'

/** ค้างนานเกินเท่านี้ถือว่าควรเดินไปดู */
const STUCK_MINUTES = 20

const idleText = (min: number) =>
  min < 1 ? 'เพิ่งขยับ' : min < 60 ? `${min} นาทีที่แล้ว` : `${Math.floor(min / 60)} ชม. ${min % 60} นาทีที่แล้ว`

/**
 * สถานะรายเมืองสำหรับดูหน้างาน (migration 017)
 *
 * ตอบคำถามเดียว: ตอนนี้ต้องเดินไปช่วยเมืองไหนก่อน
 * เรียงเมืองที่ค้างนานที่สุดขึ้นก่อน · ที่นั่งที่ไม่มีคนนั่งขึ้นแดงเสมอเพราะโซ่จะค้างถาวร
 * หน้านี้รีเฟรชตัวเองอยู่แล้วเมื่อมีใครตอบถูก (realtime)
 */
export function CityStatusPanel({ rows }: { rows: CityStatus[] }) {
  if (rows.length === 0) return null

  // ค้างนานสุดก่อน · เมืองที่จบแล้วไปท้ายสุด
  const sorted = [...rows].sort((a, b) =>
    Number(a.done) - Number(b.done) || b.idle_minutes - a.idle_minutes)

  return (
    <section className="panel" style={{ padding: '1.4rem', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
        <span className="stamp" style={{ fontSize: '0.72rem', color: 'var(--neon)' }}>ตอนนี้ค้างที่ใคร</span>
        <span style={{ fontFamily: 'var(--tech)', fontSize: '0.76rem', color: 'var(--muted)' }}>
          เรียงเมืองที่ค้างนานที่สุดขึ้นก่อน · อัปเดตเอง
        </span>
      </div>

      <ul className="stuck-list">
        {sorted.map(city => {
          const tone = city.done ? 'done'
            : !city.waiting_seated ? 'empty'
            : city.idle_minutes >= STUCK_MINUTES ? 'stuck' : 'live'

          return (
            <li key={city.city_id} className="stuck-row" data-tone={tone}>
              <span className="stuck-city">
                <strong>{city.name_en}</strong>
                <small>เมือง {String(city.city_id).padStart(2, '0')}</small>
              </span>

              <span className="stuck-who">
                {city.done
                  ? <><CircleCheck size={15} aria-hidden="true" /> ไขครบทั้งเมืองแล้ว</>
                  : !city.waiting_seated
                    ? <><UserX size={15} aria-hidden="true" /> คาวบอย #{city.current_seat} ไม่มีคนนั่ง — โซ่ค้างถาวร</>
                    : <>รอ <strong>{city.waiting_name || city.waiting_email}</strong> · คาวบอย #{city.current_seat}</>}
              </span>

              <span className="stuck-time">
                {!city.done && <><Clock size={13} aria-hidden="true" /> {idleText(city.idle_minutes)}</>}
              </span>

              <span className="stuck-count">{city.solved} / {city.total}</span>
            </li>
          )
        })}
      </ul>

      <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--muted)', lineHeight: 1.7 }}>
        แดง = ต้องไปจัดการ (ไม่มีคนนั่ง) · เหลือง = ค้างเกิน {STUCK_MINUTES} นาที ลองไปดูว่าน้องติดตรงไหน
      </p>
    </section>
  )
}
