'use client'

import { useEffect, useRef, useState } from 'react'
import { BookUser, LogOut, MapPin } from 'lucide-react'
import { logoutAction } from '@/actions/auth'
import { NavShell, type NavItem } from './NavShell'
import { Avatar } from './Avatar'
import { ProfilePassport } from './ProfilePassport'
import { campTitle } from '@/lib/profile/titles'
import type { SessionUser } from '@/types/app'

export function AppNav({ user, decryptUnlocked }: { user: SessionUser; decryptUnlocked: boolean }) {
  const items: NavItem[] = [
    { href: '/camp',   label: 'ค่ายคอม' },
    // เครื่องถอดรหัสอยู่ใต้เมนูนี้ จุดเรืองแสงจึงย้ายมาติดที่นี่
    { href: '/senior', label: 'ตามหาพี่รหัส', dot: decryptUnlocked ? { label: 'ประตูสำนักงานนายอำเภอเปิดแล้ว' } : undefined },
  ]
  if (user.role === 'admin') items.push({ href: '/admin', label: 'พี่ค่าย', tone: 'ember' })

  return <NavShell brandHref="/camp" items={items} cta={<ProfileMenu user={user} />} />
}

function ProfileMenu({ user }: { user: SessionUser }) {
  const [open, setOpen] = useState(false)
  const [viewing, setViewing] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const name = user.nickname || user.displayName || user.email

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="nav-pop-anchor">
      <button
        type="button"
        className="btn-cream"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls="profile-pop"
        onClick={() => setOpen(v => !v)}
      >
        โปรไฟล์
      </button>

      {open && (
        <div id="profile-pop" className="nav-pop">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar src={user.avatarSrc} name={name} size={48} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {name}
              </div>
              {user.nickname && user.displayName && (
                <div style={{ fontSize: '0.82rem', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.displayName}
                </div>
              )}
              <div style={{ fontFamily: 'var(--tech)', fontSize: '0.78rem', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.email}
              </div>
            </div>
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '0.6rem 0.75rem',
            borderRadius: 10, background: 'var(--plank-2)', fontSize: '0.88rem',
          }}>
            <MapPin size={15} color="var(--brass)" aria-hidden="true" />
            <span>
              {/* ฉายาขึ้นก่อนเสมอ: พี่ค่ายได้ยศ น้องได้คาวบอย/คาวเกิร์ล#รุ่น (migration 020) */}
              <strong style={{ color: 'var(--brass-lit)' }}>{campTitle(user)}</strong>
              {' · '}
              {user.role === 'admin'
                ? 'ดูแลทุกเมือง'
                : user.cityId && user.seatIndex
                  ? `เมือง ${user.cityId} · หมายเลขประจำตัว #${user.seatIndex}`
                  : 'ยังไม่ถูกจัดลงเมือง'}
            </span>
          </div>

          <button type="button" className="btn-ghost" style={{ width: '100%', borderRadius: 10 }}
                  onClick={() => { setOpen(false); setViewing(true) }}>
            <BookUser size={15} aria-hidden="true" /> ดูโปรไฟล์
          </button>

          <form action={logoutAction}>
            <button type="submit" className="btn-ghost" style={{ width: '100%', borderRadius: 10 }}>
              <LogOut size={15} aria-hidden="true" /> ออกจากระบบ
            </button>
          </form>
        </div>
      )}

      <ProfilePassport user={user} open={viewing} onClose={() => setViewing(false)} />
    </div>
  )
}
