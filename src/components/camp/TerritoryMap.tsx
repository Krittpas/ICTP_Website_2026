'use client'

import Image from 'next/image'
import type { City, CityProgress } from '@/types/app'

interface Props {
  cities: City[]
  progress: Record<number, CityProgress>
  /** จำนวนปริศนาที่เปิดใช้จริงของแต่ละเมือง */
  totals: Record<number, number>
  /** เมืองของผู้ใช้ — จะถูกเน้นให้เห็นชัดกว่าเมืองอื่น */
  highlightCityId?: number | null
  onSelect?: (cityId: number) => void
}

export function TerritoryMap({ cities, progress, totals, highlightCityId, onSelect }: Props) {
  return (
    <div style={{
      position: 'relative', width: '100%', aspectRatio: '2 / 1',
      background: 'var(--plank)', border: '1px solid var(--line)',
      borderRadius: 4, overflow: 'hidden',
    }}>
      <Image
        src="/territory-map.svg"
        alt="แผนที่ดินแดนหุบเขาแบบลายเส้น แสดงเมืองทั้งหกเเละสถานที่ต่าง ๆ"
        fill
        sizes="(max-width: 900px) 100vw, 900px"
        priority
        style={{ objectFit: 'cover', filter: 'var(--map-filter)', opacity: 0.72 }}
      />

      {cities.map(city => {
        const p = progress[city.id]
        const done = p?.solved_count ?? 0
        const seats = totals[city.id] ?? 0
        const complete = seats > 0 && done >= seats
        const mine = highlightCityId === city.id

        const pin = (
          <>
            <span aria-hidden="true" style={{
              display: 'block', width: mine ? 18 : 13, height: mine ? 18 : 13,
              borderRadius: '50%', margin: '0 auto 5px',
              background: complete ? 'var(--neon)' : 'var(--brass)',
              border: '2px solid var(--ground)',
              boxShadow: mine ? '0 0 0 4px color-mix(in oklab, var(--brass) 30%, transparent)' : 'none',
            }} />
            <span style={{
              display: 'block', whiteSpace: 'nowrap',
              background: mine ? 'var(--brass)' : 'var(--plank)',
              color: mine ? 'var(--on-brass)' : 'var(--text)',
              border: `1px solid ${complete ? 'var(--neon)' : 'var(--line)'}`,
              padding: '4px 9px', borderRadius: 2,
            }}>
              <span className="stamp" style={{ fontSize: '0.72rem', display: 'block' }}>
                {String(city.id).padStart(2, '0')} {city.name_en}
              </span>
              <span style={{ fontFamily: 'var(--tech)', fontSize: '0.72rem' }}>
                {done} / {seats}{complete ? ' ✓' : ''}
              </span>
            </span>
          </>
        )

        const position: React.CSSProperties = {
          position: 'absolute',
          left: `${city.map_x}%`,
          top: `${city.map_y}%`,
          transform: 'translateX(-50%)',
          textAlign: 'center',
        }

        return onSelect ? (
          <button
            key={city.id}
            type="button"
            onClick={() => onSelect(city.id)}
            style={{ ...position, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
          >
            {pin}
          </button>
        ) : (
          <div key={city.id} style={position}>{pin}</div>
        )
      })}
    </div>
  )
}
