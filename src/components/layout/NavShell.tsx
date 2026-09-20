'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'

export interface NavItem {
  href: string
  label: string
  /** จุดเรืองแสงข้างเมนู เช่น เครื่องถอดรหัสปลดแล้ว */
  dot?: { label: string }
  /** เมนูพี่ค่ายใช้สี ember ให้แยกออกจากเมนูปกติ */
  tone?: 'ember'
}

/**
 * แถบนำทางแบบลอย ใช้ร่วมกันทั้งหน้าสาธารณะและหน้าในระบบ
 * โลโก้ซ้าย · เมนูกลาง · ปุ่มหลักขวา — จอแคบเมนูกลางย้ายไปอยู่ในลิ้นชัก
 * overlay = ลอยทับภาพ hero (หน้าแรก) แทนที่จะดันเนื้อหาลง
 */
export function NavShell({ brandHref, items, cta, overlay = false }: {
  brandHref: string
  items: NavItem[]
  /** ปุ่มหลักด้านขวา (ปุ่มครีม) */
  cta: React.ReactNode
  overlay?: boolean
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  // เปลี่ยนหน้าแล้วปิดลิ้นชักเอง
  useEffect(() => setOpen(false), [pathname])

  const isActive = ({ href }: NavItem) =>
    !href.startsWith('#') && (pathname === href || pathname.startsWith(href + '/'))

  const renderLinks = () => items.map(item => (
    <Link
      key={item.href}
      href={item.href}
      className="nav-link"
      data-tone={item.tone}
      aria-current={isActive(item) ? 'page' : undefined}
      onClick={() => setOpen(false)}
    >
      {item.label}
      {item.dot && <span className="nav-dot" role="img" aria-label={item.dot.label} />}
    </Link>
  ))

  return (
    <div className={overlay ? 'site-nav-wrap site-nav-wrap--overlay' : 'site-nav-wrap'}>
      <header className="site-nav">
        <Link href={brandHref} className="nav-brand" aria-label="ICTP Family 2026 หน้าแรก">
          <Image src="/logo-ictp.webp" alt="" width={766} height={580} preload className="nav-logo" />
          <span className="nav-brand-text">
            <span className="nav-brand-main">Cybering Saloon</span>
            <span className="nav-brand-sub">ICTP CAMP · 2026</span>
          </span>
        </Link>

        <nav className="nav-links" aria-label="เมนูหลัก">{renderLinks()}</nav>

        <div className="nav-actions">
          <span className="theme-slot"><ThemeToggle /></span>
          {cta}
          <button
            type="button"
            className="icon-btn nav-menu-btn"
            aria-expanded={open}
            aria-controls="nav-drawer"
            aria-label={open ? 'ปิดเมนู' : 'เปิดเมนู'}
            onClick={() => setOpen(v => !v)}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        <nav id="nav-drawer" className="nav-drawer" data-open={open} aria-label="เมนูหลัก (มือถือ)">
          {renderLinks()}
          <div className="theme-slot-mobile"><ThemeToggle /> สลับโทนสี</div>
        </nav>
      </header>
    </div>
  )
}
