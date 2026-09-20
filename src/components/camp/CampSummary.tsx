import type { CampState } from '@/types/app'
import type { GoldenKey } from '@/lib/camp/keys'
import { GoldenKeys } from './GoldenKeys'

/** ตัวเลขสรุปทั้งค่าย — รหัสลับที่ได้ · ชิ้นส่วนกุญแจทองคำ · ประตูสำนักงานนายอำเภอ */
export function CampSummary({ camp, solved, total, keys }: {
  camp: CampState; solved: number; total: number; keys: GoldenKey[]
}) {
  const percent = total > 0 ? Math.round((solved / total) * 100) : 0
  const missing = keys.filter(k => !k.collected).length

  return (
    <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))' }}>
      <div className="panel" style={{ padding: '1.1rem' }}>
        <div className="stamp" style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>รหัสลับที่ได้แล้ว</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginTop: 5 }}>
          <span style={{ fontFamily: 'var(--display)', fontSize: '2.3rem', color: 'var(--brass-lit)' }}>{solved}</span>
          <span style={{ color: 'var(--muted)' }}>/ {total}</span>
        </div>
        <div role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}
             aria-label="ความคืบหน้ารวมทั้งค่าย"
             style={{ height: 7, background: 'var(--plank-2)', borderRadius: 4, marginTop: 10, overflow: 'hidden' }}>
          <div style={{ width: `${percent}%`, height: '100%', background: 'var(--brass)' }} />
        </div>
      </div>

      <div className="panel" style={{ padding: '1.1rem' }}>
        <div className="stamp" style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>ชิ้นส่วนกุญแจทองคำ</div>
        <div style={{ marginTop: 5 }}>
          <GoldenKeys keys={keys} compact />
        </div>
      </div>

      <div className="panel" style={{
        padding: '1.1rem',
        borderColor: camp.decrypt_unlocked ? 'var(--neon)' : 'color-mix(in oklab, var(--ember) 45%, transparent)',
      }}>
        <div className="stamp" style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>ประตูสำนักงานนายอำเภอ</div>
        <div style={{
          fontFamily: 'var(--display)', fontSize: '1.7rem', marginTop: 7,
          color: camp.decrypt_unlocked ? 'var(--neon)' : 'var(--ember)',
        }}>
          {camp.decrypt_unlocked ? 'เปิดแล้ว' : 'ปิดตาย'}
        </div>
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.78rem', color: 'var(--muted)' }}>
          {camp.decrypt_unlocked
            ? camp.decrypt_unlock_mode === 'manual' ? 'พี่ค่ายเปิดประตูให้ก่อน' : 'รวมกุญแจครบ 6 ชิ้นแล้ว'
            : `ขาดชิ้นส่วนกุญแจอีก ${missing} ชิ้น`}
        </p>
      </div>
    </div>
  )
}
