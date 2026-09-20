import { Check, Lock } from 'lucide-react'
import type { BoardSeat } from '@/types/app'

const COLORS = {
  solved: 'var(--neon)',
  active: 'var(--brass-lit)',
  locked: 'var(--muted)',
} as const

const LABELS = {
  solved: 'ผ่านแล้ว',
  active: 'ถึงตาคนนี้',
  locked: 'ยังล็อก',
} as const

/** โซ่ 6 ที่นั่งของเมืองหนึ่ง — ข้อมูลมาจาก get_city_board() ซึ่งไม่มีโจทย์หรือรหัสลับติดมา */
export function SeatChain({ seats, mySeat }: { seats: BoardSeat[]; mySeat?: number | null }) {
  return (
    <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {seats.map(seat => {
        const isMe = seat.seat_index === mySeat
        return (
          <li key={seat.seat_index} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '0.65rem 0.75rem',
            background: seat.status === 'locked' ? 'transparent' : 'var(--plank-2)',
            borderLeft: `3px solid ${COLORS[seat.status]}`,
            borderRadius: 2,
          }}>
            <span className="stamp" style={{ fontSize: '0.76rem', color: COLORS[seat.status], width: 52 }}>
              #{seat.seat_index}
            </span>
            <span style={{ flexGrow: 1, fontSize: '0.9rem', color: isMe ? 'var(--brass-lit)' : 'var(--text)' }}>
              {seat.display_name}{isMe && ' (คุณ)'}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', color: COLORS[seat.status] }}>
              {seat.status === 'solved' && <Check size={13} aria-hidden="true" />}
              {seat.status === 'locked' && <Lock size={13} aria-hidden="true" />}
              {LABELS[seat.status]}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
