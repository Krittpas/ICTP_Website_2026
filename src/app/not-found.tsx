import Link from 'next/link'
import Image from 'next/image'
import { Compass } from 'lucide-react'

export const metadata = { title: 'ไม่พบหน้านี้' }

/**
 * หน้า 404 ตามธีม — ใช้ทั้งเว็บ ทั้งคนที่ล็อกอินแล้วและยังไม่ได้ล็อกอิน
 * ไม่มีลิงก์ไปหน้าในระบบ เพราะคนที่ยังไม่ล็อกอินจะโดนเด้งกลับมาที่ /login อยู่ดี
 */
export default function NotFound() {
  return (
    <main className="status-page">
      <div className="panel status-card">
        <span className="stamp status-kicker">✦ ICTP OFFICIAL NOTICE ✦</span>

        <Image
          src="/mascot-stand.webp" alt="มาสคอตวัวคาวบอยยืนงงอยู่กลางทาง"
          width={900} height={1160} preload className="status-mascot"
        />

        <h1 className="status-code">404</h1>
        <h2 className="status-title">หลงทางในหุบเขา</h2>
        <p className="status-text">
          ไม่มีหน้านี้ในแผนที่ของเรา<br />
          อาจพิมพ์ที่อยู่ผิด หรือหน้านี้ถูกย้ายไปแล้ว
        </p>

        <Link href="/" className="btn-brass status-action">
          <Compass size={16} aria-hidden="true" /> กลับหน้าแรก
        </Link>
      </div>
    </main>
  )
}
