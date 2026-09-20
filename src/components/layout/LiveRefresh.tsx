'use client'

import { useLiveCamp } from '@/hooks/useLiveCamp'

/** ตัวบอกสถานะ realtime — ดึงข้อมูลใหม่ผ่าน server เสมอ ไม่เก็บ state เอง */
export function LiveRefresh() {
  const { connected } = useLiveCamp()

  return (
    <div aria-live="polite" style={{
      position: 'fixed', right: 12, bottom: 12, zIndex: 40,
      display: 'inline-flex', alignItems: 'center', gap: 7,
      padding: '0.4rem 0.7rem', borderRadius: 999,
      background: 'var(--plank)', border: '1px solid var(--line)',
      fontFamily: 'var(--tech)', fontSize: '0.74rem', letterSpacing: '0.1em',
      color: connected ? 'var(--neon)' : 'var(--muted)',
    }}>
      <span aria-hidden="true" style={{
        width: 7, height: 7, borderRadius: '50%',
        background: connected ? 'var(--neon)' : 'var(--muted)',
      }} />
      {connected ? 'LIVE' : 'OFFLINE'}
    </div>
  )
}
