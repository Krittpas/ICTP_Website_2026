'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/senior/announcements', label: 'ประกาศ' },
  { href: '/senior/puzzles',       label: 'ปริศนา & ภาพรวม' },
  { href: '/senior/decrypt',       label: 'ถอดรหัส' },
]

/** แท็บย่อยของ "ตามหาพี่รหัส" — ต้องเป็น client เพื่ออ่าน pathname มาไฮไลต์แท็บที่เปิดอยู่ */
export function SeniorTabs() {
  const pathname = usePathname()

  return (
    <nav aria-label="เมนูตามหาพี่รหัส" style={{ display: 'flex', gap: 4, flexWrap: 'wrap', borderBottom: '1px solid var(--line)' }}>
      {TABS.map(tab => (
        <Link
          key={tab.href}
          href={tab.href}
          className="tab-link"
          aria-current={pathname.startsWith(tab.href) ? 'page' : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  )
}
