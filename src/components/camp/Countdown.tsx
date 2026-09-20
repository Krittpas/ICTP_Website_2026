'use client'

import { useEffect, useState } from 'react'

function split(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  return [
    ['DAYS', Math.floor(s / 86400)],
    ['HRS',  Math.floor((s % 86400) / 3600)],
    ['MIN',  Math.floor((s % 3600) / 60)],
    ['SEC',  s % 60],
  ] as const
}

/**
 * เริ่มที่ null เสมอ เพราะเวลาของ server กับ client ไม่มีทางตรงกันพอดี
 * ถ้า render ตัวเลขตั้งแต่ครั้งแรกจะเกิด hydration mismatch
 */
export function Countdown({ target }: { target: string }) {
  const [left, setLeft] = useState<ReturnType<typeof split> | null>(null)

  useEffect(() => {
    const at = new Date(target).getTime()
    const tick = () => setLeft(split(at - Date.now()))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [target])

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {(left ?? split(0)).map(([label], i) => (
        <div key={label} style={{
          background: 'var(--plank-2)', border: '1px solid var(--line)',
          padding: '0.55rem 0.95rem', textAlign: 'center', minWidth: 62, borderRadius: 2,
        }}>
          <div style={{ fontFamily: 'var(--display)', fontSize: '1.55rem', color: 'var(--neon)', lineHeight: 1.1 }}>
            {left ? String(left[i][1]).padStart(2, '0') : '––'}
          </div>
          <div className="stamp" style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{label}</div>
        </div>
      ))}
    </div>
  )
}
