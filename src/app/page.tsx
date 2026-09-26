import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { KeyRound, Link2, Map as MapIcon, Megaphone, Unlock } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/dal'
import { getCampState } from '@/lib/camp/state'
import { Countdown } from '@/components/camp/Countdown'
import { NavShell } from '@/components/layout/NavShell'
import { Gallery } from '@/components/landing/Gallery'
import { GALLERY } from '@/content/gallery'
import { AnnouncementAttachments } from '@/components/announcements/AnnouncementAttachments'
import { fetchAnnouncements } from '@/lib/announcements/query'
import type { City } from '@/types/app'

const STEPS = [
  { Icon: Link2,    title: 'ไขปริศนาลูกโซ่', body: 'คาวบอย #1 เริ่มก่อน ตอบถูกแล้วปริศนาของคนถัดไปจึงปรากฏ ทั้งเมืองต้องช่วยกันคลายคำสาปโซ่ตรวน' },
  { Icon: KeyRound, title: 'เก็บรหัสลับ',    body: 'ทุกคนที่ตอบถูกได้รหัสลับประจำตัวหนึ่งชิ้น เก็บไว้ให้ดี เพราะต้องใช้ในด่านสุดท้าย' },
  { Icon: Unlock,   title: 'ถอดรหัส',        body: 'รวมชิ้นส่วนกุญแจทองคำครบ 6 เมือง ประตูสำนักงานนายอำเภอจะเปิด นำรหัสลับของตัวเองใส่เครื่องเพื่อเผยตัวตนพี่รหัส' },
]

const FEATURES = [
  { Icon: Megaphone, title: 'หน้าประกาศ',           body: 'ข่าวสารจากพี่ค่ายตลอดกิจกรรม ประกาศสำคัญถูกปักหมุดไว้บนสุดเสมอ' },
  { Icon: MapIcon,   title: 'ปริศนา & ภาพรวม', body: 'ดูปริศนาของตัวเอง และเห็นทุกเมืองขยับแบบเรียลไทม์ ไม่ต้องกดรีเฟรช เมืองไหนได้ชิ้นส่วนกุญแจแล้วรู้ทันที' },
]

export default async function LandingPage() {
  if (await getCurrentUser()) redirect('/camp')

  const supabase = await createClient()
  const [camp, { data: cities }, news] = await Promise.all([
    getCampState(),
    supabase.from('cities').select('*').order('id'),
    fetchAnnouncements(supabase, 3),
  ])

  const townList = (cities ?? []) as City[]

  return (
    <main>
      <NavShell
        overlay
        brandHref="#top"
        items={[
          { href: '#about',   label: 'เกี่ยวกับ' },
          { href: '#gallery', label: 'ภาพบรรยากาศ' },
        ]}
        cta={<Link href="/login" className="btn-cream">เข้าสู่ระบบ</Link>}
      />

      {/* ── Hero: ภาพเต็มจอ ── */}
      <section id="top" className="hero">
        {/*
          เคยเป็น .svg ที่ฝังรูปไว้ข้างใน 33 MB และใส่ unoptimized ไว้ด้วย
          = ทุกคนที่เปิดหน้านี้ต้องโหลดเต็มไฟล์ ไม่ผ่านตัวย่อรูปเลย
          .webp ปล่อยให้ next/image ย่อและแปลงฟอร์แมตตามจอที่เปิดจริง
        */}
        <Image
          src="/hero-banner.webp" alt="" fill preload
          sizes="100vw"
          className="hero-bg"
        />
        <div className="hero-shade" aria-hidden="true" />

        <div className="hero-content">
          <Image
            src="/logo-ictp.webp" alt="ICTP Family 2026"
            width={766} height={580} preload
            className="hero-logo"
          />

          <h1 className="hero-title">
            “ชายแดนเก่า เครือข่ายใหม่ <span style={{ whiteSpace: 'nowrap' }}>รหัสลับที่รอคุณอยู่”</span>
          </h1>

          <p className="hero-lead">
            เว็บไซต์สำหรับสายการเรียน ICTP ปี 2026 ที่ Cybering Saloon<br />
            ไขปริศนาต่อกันเป็นลูกโซ่กับเพื่อนร่วมเมือง รวมรหัสลับให้ครบ<br />
            แล้วเปิดเครื่องถอดรหัสเพื่อตามหาพี่รหัสของตัวเอง
          </p>

          {!camp.camp_open && camp.opens_at && (
            <div className="hero-countdown">
              <span className="stamp">เปิดระบบในอีก</span>
              <Countdown target={camp.opens_at} />
            </div>
          )}

          <div className="hero-actions">
            <Link href="/login" className="hero-btn hero-btn--primary">เข้าสู่ระบบ</Link>
            <a href="#about" className="hero-btn hero-btn--ghost">เกี่ยวกับกิจกรรม</a>
          </div>
        </div>
      </section>

      {/* ── เกี่ยวกับ ── */}
      <section id="about" className="landing-section">
        <div className="landing-inner">
          <header className="section-head">
            <span className="stamp section-kicker">★ ABOUT THE CAMP ★</span>
            <h2 className="section-title">เกี่ยวกับกิจกรรม</h2>
            <p className="section-lead">
              เว็บไซต์นี้เป็นเครื่องมือหลักของค่าย ICTP ประจำปี 2026
              น้องทุกคนจะสามารถตามหาพี่รหัสและติดตามข่าวสารหรือกิจกรรมต่าง ๆ ได้จากเว็บไซต์นี้
            </p>
          </header>

          <ol className="steps">
            {STEPS.map(({ Icon, title, body }, i) => (
              <li key={title} className="step">
                <span className="step-no">{String(i + 1).padStart(2, '0')}</span>
                <Icon size={26} color="var(--brass)" aria-hidden="true" />
                <h3 className="step-title">{title}</h3>
                <p className="step-body">{body}</p>
              </li>
            ))}
          </ol>

          <h3 className="sub-title">ในระบบมีอะไรบ้าง</h3>
          <div className="card-grid">
            {FEATURES.map(({ Icon, title, body }) => (
              <div key={title} className="panel feature">
                <Icon size={24} color="var(--brass)" aria-hidden="true" />
                <h4 className="feature-title">{title}</h4>
                <p className="feature-body">{body}</p>
              </div>
            ))}
          </div>

          {townList.length > 0 && (
            <>
              <h3 className="sub-title">ดินแดน 6 เมือง</h3>
              <div className="card-grid card-grid--cities">
                {townList.map(city => (
                  <div key={city.id} className="city-card" style={{ borderTopColor: city.accent_hex }}>
                    <span className="stamp" style={{ color: 'var(--muted)' }}>
                      เมืองที่ {String(city.id).padStart(2, '0')}
                    </span>
                    <div className="city-name">{city.name_en}</div>
                    <div className="city-blurb">{city.blurb}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* ── ภาพบรรยากาศ ── */}
      <section id="gallery" className="landing-section landing-section--alt">
        <div className="landing-inner">
          <header className="section-head">
            <span className="stamp section-kicker">★ MEMORIES ★</span>
            <h2 className="section-title">ภาพบรรยากาศ</h2>
            <p className="section-lead">ความทรงจำจากค่าย ICTP ปีก่อน ๆ</p>
          </header>
          <Gallery photos={GALLERY} />
        </div>
      </section>

      {/* ── ประกาศล่าสุด ── */}
      {news.length > 0 && (
        <section id="news" className="landing-section">
          <div className="landing-inner" style={{ maxWidth: 900 }}>
            <header className="section-head">
              <span className="stamp section-kicker">★ OFFICIAL DISPATCH ★</span>
              <h2 className="section-title">ประกาศล่าสุด</h2>
            </header>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {news.map(item => (
                <article key={item.id} className="panel" style={{ padding: '1.2rem 1.4rem' }}>
                  {item.is_pinned && (
                    <span className="stamp" style={{ color: 'var(--brass-lit)' }}>★ ปักหมุด</span>
                  )}
                  <h3 style={{ margin: '0.3rem 0 0.5rem', fontSize: '1.15rem' }}>{item.title}</h3>
                  <p style={{ margin: 0, lineHeight: 1.75, color: 'var(--muted)', whiteSpace: 'pre-wrap' }}>
                    {item.body}
                  </p>
                  <AnnouncementAttachments items={item.attachments} limitImages={3} />
                  <div style={{ marginTop: '0.7rem', fontSize: '0.85rem', color: 'var(--muted)' }}>
                    ประกาศจาก {item.creator_display_name}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      <footer className="landing-footer">
        <Image src="/logo-ictp.webp" alt="" width={766} height={580} style={{ width: 'auto', height: 56 }} />
        <span className="stamp" style={{ color: 'var(--muted)' }}>© 2026 ICTP FAMILY · CYBERING SALOON</span>
      </footer>
    </main>
  )
}
