import Link from 'next/link'
import Image from 'next/image'
import { Megaphone } from 'lucide-react'
import { requireUser } from '@/lib/auth/dal'
import { getCampState } from '@/lib/camp/state'
import { Countdown } from '@/components/camp/Countdown'

export const metadata = { title: 'หน้าแรกค่าย' }

export default async function CampHomePage() {
  const [user, camp] = await Promise.all([requireUser(), getCampState()])

  // ระบบยังไม่เปิด: ไม่ render เนื้อหาเลย ไม่ใช่ซ่อนด้วย CSS
  if (!camp.camp_open) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '2rem' }}>
        <div className="panel" style={{ maxWidth: 560, width: '100%', padding: '2rem 1.75rem', textAlign: 'center' }}>
          <span className="stamp" style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>✦ ICTP OFFICIAL NOTICE ✦</span>

          <Image
            src="/mascot-stand.webp" alt="มาสคอตวัวคาวบอยยืนเฝ้าประตู"
            width={160} height={160} preload
            style={{ display: 'block', margin: '1rem auto 0.5rem', width: 160, height: 'auto', borderRadius: 16, border: '1px solid var(--line)' }}
          />

          <h1 style={{ fontFamily: 'var(--display)', fontSize: '1.9rem', lineHeight: 1.2, color: 'var(--brass-lit)', margin: '0 0 0.6rem' }}>
            ระบบยังไม่เปิด<br />ให้เข้าใช้งาน
          </h1>

          {camp.opens_at && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, margin: '1.5rem 0' }}>
              <span className="stamp" style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>เปิดระบบในอีก</span>
              <Countdown target={camp.opens_at} />
            </div>
          )}

          <Link href="/senior/announcements" className="btn-ghost" style={{ marginTop: '1.25rem' }}>
            <Megaphone size={15} aria-hidden="true" /> ไปหน้าประกาศ
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontFamily: 'var(--display)', fontSize: '2rem', color: 'var(--brass-lit)', margin: '0 0 0.3rem' }}>
          ยินดีต้อนรับ {user.nickname || user.displayName}
        </h1>
        <p style={{ margin: 0, color: 'var(--muted)' }}>ซาลูนเปิดแล้ว เลือกได้เลยว่าจะไปไหนต่อ</p>
      </div>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        {[
          { href: '/senior/puzzles',       title: 'ปริศนา & ภาพรวม', body: 'ไขปริศนาของตัวเอง และดูชิ้นส่วนกุญแจทองคำทั้ง 6 เมืองแบบเรียลไทม์' },
          { href: '/senior/announcements', title: 'ประกาศ',        body: 'ข่าวสารจากพี่ค่าย' },
        ].map(card => (
          <Link key={card.href} href={card.href} className="panel" style={{
            padding: '1.4rem', textDecoration: 'none', color: 'inherit', display: 'block',
          }}>
            <h2 style={{ fontFamily: 'var(--display)', fontSize: '1.2rem', margin: '0 0 0.5rem', color: 'var(--brass-lit)' }}>
              {card.title}
            </h2>
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--muted)', lineHeight: 1.7 }}>{card.body}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
