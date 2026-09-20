import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth/dal'
import { getCampState } from '@/lib/camp/state'
import { getPuzzleTotals } from '@/lib/camp/totals'
import { toGoldenKeys } from '@/lib/camp/keys'
import { PUZZLE_BUCKET, PUZZLE_IMAGE_TTL } from '@/lib/puzzles/media'
import { getMyPuzzle } from '@/actions/puzzle'
import { CampSummary } from '@/components/camp/CampSummary'
import { CityProgressList } from '@/components/camp/CityProgressList'
import { TerritoryMap } from '@/components/camp/TerritoryMap'
import { SeatChain } from '@/components/camp/SeatChain'
import { MyPuzzlePanel } from '@/components/puzzle/MyPuzzlePanel'
import type { BoardSeat, City, CityProgress, SeatStatus } from '@/types/app'

export const metadata = { title: 'ปริศนา & ภาพรวม' }

/** หน้าเดียวรวมปริศนาของฉัน กระดานเมือง และภาพรวมทั้งค่าย */
export default async function PuzzlesPage() {
  const [user, camp] = await Promise.all([requireUser(), getCampState()])
  const supabase = await createClient()

  const [{ data: cities }, { data: progress }, { data: seatRows }, puzzle] = await Promise.all([
    supabase.from('cities').select('*').order('id'),
    supabase.from('city_progress').select('city_id, current_seat, solved_count, last_solved_at').order('city_id'),
    // ต้องรัน migration 009 ก่อน ไม่อย่างนั้นได้ null และแถบรายเมืองเดาสถานะจาก current_seat แทน
    supabase.rpc('get_camp_seats'),
    getMyPuzzle(),
  ])

  const townList = (cities ?? []) as City[]
  const rows = (progress ?? []) as CityProgress[]
  const totals = await getPuzzleTotals(townList.map(c => c.id))
  const byCity: Record<number, CityProgress> = {}
  for (const row of rows) byCity[row.city_id] = row

  const seatStates: Record<number, SeatStatus[]> = {}
  for (const row of (seatRows ?? []) as { city_id: number; status: SeatStatus }[]) {
    (seatStates[row.city_id] ??= []).push(row.status)
  }

  const solvedTotal = rows.reduce((sum, r) => sum + r.solved_count, 0)
  const keys = toGoldenKeys(townList, byCity, totals.byCity)

  // รูปโจทย์อยู่ในที่เก็บส่วนตัว — ขอลิงก์ชั่วคราวด้วยสิทธิ์ของน้องเอง
  // policy ของ Storage ถามฐานข้อมูลว่าถึงตาหรือยัง ยังไม่ถึงตา = ขอลิงก์ไม่ได้
  let puzzleImage: string | null = null
  if (puzzle.status === 'active' && puzzle.media_url) {
    const { data } = await supabase.storage.from(PUZZLE_BUCKET).createSignedUrl(puzzle.media_url, PUZZLE_IMAGE_TTL)
    puzzleImage = data?.signedUrl ?? null
  }

  // กระดานเมืองของตัวเอง — get_city_board() คืนแค่สถานะ ไม่มีโจทย์หรือรหัสลับติดมา
  let seats: BoardSeat[] = []
  if (user.cityId) {
    const { data } = await supabase.rpc('get_city_board', { p_city_id: user.cityId })
    seats = (data ?? []) as BoardSeat[]
  }

  const myCity = townList.find(c => c.id === user.cityId)

  return (
    <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))' }}>
      <section style={{ gridColumn: '1 / -1' }}>
        <CampSummary
          camp={camp}
          solved={solvedTotal}
          total={totals.total}
          keys={keys}
        />
      </section>

      <section style={{ gridColumn: '1 / -1' }}>
        <TerritoryMap
          cities={townList}
          progress={byCity}
          totals={totals.byCity}
          highlightCityId={user.cityId}
        />
      </section>

      <section className="panel" style={{ padding: '1.4rem' }}>
        <MyPuzzlePanel puzzle={puzzle} campOpen={camp.camp_open} imageUrl={puzzleImage} />
      </section>

      <section className="panel" style={{ padding: '1.4rem' }}>
        {myCity ? (
          <>
            <div className="stamp" style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
              เมืองที่ {String(myCity.id).padStart(2, '0')}
            </div>
            <h2 style={{ fontFamily: 'var(--display)', fontSize: '1.3rem', color: 'var(--brass-lit)', margin: '0.3rem 0 0.5rem' }}>
              {myCity.name_en}
            </h2>
            <p style={{ margin: '0 0 1rem', fontSize: '0.86rem', color: 'var(--muted)', lineHeight: 1.7 }}>
              {myCity.blurb}
            </p>
            <SeatChain seats={seats} mySeat={user.seatIndex} />
          </>
        ) : (
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.9rem', lineHeight: 1.8 }}>
            คุณยังไม่ถูกจัดลงเมือง รอพี่ค่ายประกาศรายชื่อก่อนนะ
          </p>
        )}
      </section>

      <div style={{ gridColumn: '1 / -1' }}>
        <CityProgressList
          cities={townList}
          progress={byCity}
          totals={totals.byCity}
          seatStates={seatStates}
          myCityId={user.cityId}
        />
      </div>
    </div>
  )
}
