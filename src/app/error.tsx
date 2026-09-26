'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { RotateCcw, TriangleAlert } from 'lucide-react'

/**
 * กันหน้าพังทั้งเว็บ — แทนหน้า error ดิบของ Next ที่หลุดธีมไปคนละโลก
 *
 * ต้องเป็น client component ตามที่ Next กำหนด และรับ reset() มาให้ลองใหม่
 * โดยไม่ต้องโหลดหน้าใหม่ทั้งหน้า
 *
 * ไม่แสดงข้อความ error ดิบให้ผู้ใช้เห็น — อาจมีชื่อตาราง ชื่อฟังก์ชัน หรือรายละเอียดฝั่ง server ติดมา
 * แสดงแค่ digest ที่ Next สร้างให้ พอให้พี่ค่ายแจ้งกลับมาแล้วตามหาใน log ได้
 */
export default function GlobalError({
  error, reset,
}: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('page error:', error) }, [error])

  return (
    <main className="status-page">
      <div className="panel status-card" style={{ borderColor: 'color-mix(in oklab, var(--ember) 50%, transparent)' }}>
        <span className="stamp status-kicker" style={{ color: 'var(--ember)' }}>✦ SOMETHING BROKE ✦</span>

        <TriangleAlert size={52} className="icon-center" color="var(--ember)" strokeWidth={1.3} aria-hidden="true"
                       style={{ marginTop: '1.2rem' }} />

        <h1 className="status-title" style={{ color: 'var(--ember)', marginTop: '1rem' }}>
          ระบบขัดข้อง
        </h1>
        <p className="status-text">
          หน้านี้โหลดไม่สำเร็จ ลองกดโหลดใหม่ดูก่อน<br />
          ถ้ายังไม่หาย แจ้งพี่ค่ายพร้อมรหัสด้านล่างได้เลย
        </p>

        {error.digest && (
          <p className="status-digest">รหัสอ้างอิง · {error.digest}</p>
        )}

        <div className="status-actions">
          <button type="button" className="btn-brass" onClick={reset}>
            <RotateCcw size={16} aria-hidden="true" /> ลองใหม่
          </button>
          <Link href="/" className="btn-ghost">กลับหน้าแรก</Link>
        </div>
      </div>
    </main>
  )
}
