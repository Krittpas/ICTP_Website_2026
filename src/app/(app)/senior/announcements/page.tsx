import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth/dal'
import { AnnouncementForm } from '@/components/announcements/AnnouncementForm'
import { AdminControls } from '@/components/announcements/AdminControls'
import { AnnouncementAttachments } from '@/components/announcements/AnnouncementAttachments'
import { fetchAnnouncements } from '@/lib/announcements/query'
import { Megaphone, Pin } from 'lucide-react'

export const metadata = { title: 'ประกาศ' }

const fmt = (iso: string) =>
  new Intl.DateTimeFormat('th-TH', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(iso))

export default async function AnnouncementsPage() {
  const supabase = await createClient()
  const [user, items] = await Promise.all([requireUser(), fetchAnnouncements(supabase)])
  const isAdmin = user.role === 'admin'
  const me = user.displayName || user.email

  return (
    <div className="board">
      {isAdmin && <AnnouncementForm defaultFrom={me} />}

      {items.length === 0 ? (
        <div className="panel dispatch-empty">
          <Megaphone size={34} className="icon-center" strokeWidth={1.4} aria-hidden="true" />
          <p>ยังไม่มีประกาศ กระดานยังว่างอยู่</p>
        </div>
      ) : (
        items.map(item => (
          <article key={item.id} className={`dispatch${item.is_pinned ? ' dispatch--pinned' : ''}`}>
            <div className="dispatch-head">
              <span className="dispatch-seal" aria-hidden="true">
                <Megaphone size={17} strokeWidth={1.6} />
              </span>
              <span className="dispatch-kicker">
                <span className="stamp" style={{ fontSize: '0.66rem' }}>★ OFFICIAL DISPATCH</span>
                <span className="dispatch-from">
                  ประกาศจาก <strong>{item.creator_display_name}</strong>
                </span>
              </span>
              {item.is_pinned && (
                <span className="stamp dispatch-pin" style={{ fontSize: '0.68rem' }}>
                  <Pin size={10} aria-hidden="true" /> ปักหมุด
                </span>
              )}
            </div>

            <h2 className="dispatch-title">{item.title}</h2>

            <p className="dispatch-body">{item.body}</p>

            <AnnouncementAttachments items={item.attachments} />

            <div className="dispatch-foot">
              <span>{fmt(item.published_at ?? item.created_at)}</span>
              {item.updated_at && <span>แก้ไข {fmt(item.updated_at)}</span>}
            </div>

            {isAdmin && <AdminControls announcement={item} defaultFrom={me} />}
          </article>
        ))
      )}
    </div>
  )
}
