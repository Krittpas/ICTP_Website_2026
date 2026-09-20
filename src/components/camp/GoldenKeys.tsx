import { KeyRound } from 'lucide-react'
import type { GoldenKey } from '@/lib/camp/keys'

/** ชิ้นส่วนกุญแจทองคำ 6 ชิ้น — ครบเมื่อไหร่ ประตูสำนักงานนายอำเภอเปิด */
export function GoldenKeys({ keys, compact = false }: { keys: GoldenKey[]; compact?: boolean }) {
  const got = keys.filter(k => k.collected).length

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
        <span style={{ fontFamily: 'var(--display)', fontSize: compact ? '2.3rem' : '2rem', color: 'var(--brass-lit)' }}>{got}</span>
        <span style={{ color: 'var(--muted)' }}>/ {keys.length} ชิ้น</span>
      </div>

      <ul className="keys" aria-label={`ได้ชิ้นส่วนกุญแจทองคำแล้ว ${got} จาก ${keys.length} ชิ้น`}>
        {keys.map(k => (
          <li key={k.cityId} className="key" data-got={k.collected}
              style={{ '--key-accent': k.accent } as React.CSSProperties}
              title={`${k.name} — ${k.collected ? 'ได้ชิ้นส่วนกุญแจแล้ว' : 'ยังไขปริศนาไม่ครบ'}`}>
            <KeyRound size={compact ? 18 : 22} strokeWidth={k.collected ? 2.2 : 1.5} aria-hidden="true" />
            {!compact && <span className="key-name">{k.name}</span>}
            <span className="sr-only">{k.name}: {k.collected ? 'ได้แล้ว' : 'ยังไม่ได้'}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
