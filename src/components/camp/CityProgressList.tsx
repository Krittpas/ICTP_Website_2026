import type { City, CityProgress, SeatStatus } from '@/types/app'

/** ความคืบหน้ารายเมือง — จุดละหนึ่งที่นั่ง */
export function CityProgressList({ cities, progress, totals, seatStates = {}, myCityId }: {
  cities: City[]
  progress: Record<number, CityProgress>
  /** จำนวนปริศนาที่เปิดใช้จริงของแต่ละเมือง */
  totals: Record<number, number>
  /** สถานะจริงทีละที่นั่งจาก get_camp_seats() เรียงตามลำดับที่นั่ง */
  seatStates?: Record<number, SeatStatus[]>
  myCityId: number | null
}) {
  return (
    <section className="panel" style={{ padding: '1.4rem' }}>
      <h2 className="stamp" style={{ fontSize: '0.78rem', color: 'var(--neon)', margin: '0 0 1rem' }}>
        ความคืบหน้ารายเมือง
      </h2>

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {cities.map(city => {
          const p = progress[city.id]
          const done = p?.solved_count ?? 0
          const current = p?.current_seat ?? 1
          const seats = totals[city.id] ?? 0
          // ยังไม่ได้รัน 009 = เดาจากตำแหน่งโซ่ ซึ่งผิดเมื่อพี่ค่ายปลดที่นั่งข้ามลำดับ
          const states: SeatStatus[] = seatStates[city.id] ?? Array.from({ length: seats }, (_, i) =>
            i + 1 < current ? 'solved' : i + 1 === current ? 'active' : 'locked')
          return (
            <li key={city.id} style={{
              display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
              padding: '0.75rem 0', borderBottom: '1px solid var(--line)',
            }}>
              <div style={{ minWidth: 150 }}>
                <div style={{ fontFamily: 'var(--display)', fontSize: '1rem', color: city.id === myCityId ? 'var(--brass-lit)' : 'var(--text)' }}>
                  {city.name_en}
                </div>
                <div className="stamp" style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>
                  เมือง {String(city.id).padStart(2, '0')}{city.id === myCityId ? ' · เมืองของคุณ' : ''}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6, flexGrow: 1 }} aria-label={`ผ่านแล้ว ${done} จาก ${seats} คน`}>
                {states.map((state, i) => (
                  <span key={i} aria-hidden="true" style={{
                    width: 22, height: 22, borderRadius: 3, display: 'inline-block',
                    background: state === 'solved' ? 'var(--neon)'
                              : state === 'active' ? 'var(--brass-lit)' : 'var(--plank-2)',
                    border: state === 'locked' ? '1px solid var(--line)' : 'none',
                  }} />
                ))}
              </div>

              <span style={{ fontFamily: 'var(--tech)', fontSize: '0.9rem', minWidth: 52, textAlign: 'right' }}>
                {done} / {seats}
              </span>
            </li>
          )
        })}
      </ul>

      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: '1rem', fontSize: '0.75rem', color: 'var(--muted)' }}>
        {[['var(--neon)', 'ผ่านแล้ว'], ['var(--brass-lit)', 'กำลังถึงตา'], ['var(--plank-2)', 'ยังล็อก']].map(([color, label]) => (
          <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span aria-hidden="true" style={{ width: 12, height: 12, borderRadius: 2, background: color, border: '1px solid var(--line)' }} />
            {label}
          </span>
        ))}
      </div>
    </section>
  )
}
