'use client'

import { useState, useTransition } from 'react'
import { Pencil, Pin, PinOff, Trash2 } from 'lucide-react'
import { deleteAnnouncementAction, togglePinAction } from '@/actions/announcements'
import { AnnouncementForm } from './AnnouncementForm'
import { useConfirm } from '@/components/layout/ConfirmDialog'
import type { Announcement } from '@/types/app'

/**
 * ปุ่มพวกนี้เป็นความสะดวก ไม่ใช่การป้องกัน
 * RLS ปฏิเสธ UPDATE/DELETE ของคนที่ไม่ใช่พี่ค่ายอยู่แล้ว ต่อให้ยิง request ตรงมา
 */
export function AdminControls({ announcement, defaultFrom }: { announcement: Announcement; defaultFrom: string }) {
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const confirm = useConfirm()

  function run(fn: () => Promise<{ error?: string } | undefined>) {
    setError(null)
    start(async () => {
      const res = await fn()
      if (res?.error) setError(res.error)
    })
  }

  if (editing) {
    return (
      <div style={{ marginTop: '1rem' }}>
        <AnnouncementForm announcement={announcement} defaultFrom={defaultFrom} onDone={() => setEditing(false)} />
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
      marginTop: '0.8rem', paddingTop: '0.7rem', borderTop: '1px dashed var(--line)',
    }}>
      <button type="button" className="btn-ghost" onClick={() => setEditing(true)}
              style={{ padding: '0.45rem 0.8rem', fontSize: '0.78rem', minHeight: 40 }}>
        <Pencil size={12} aria-hidden="true" /> แก้ไข
      </button>

      <button type="button" className="btn-ghost" disabled={pending}
              onClick={() => run(() => togglePinAction(announcement.id, !announcement.is_pinned))}
              style={{ padding: '0.45rem 0.8rem', fontSize: '0.78rem', minHeight: 40 }}>
        {announcement.is_pinned
          ? <><PinOff size={12} aria-hidden="true" /> เลิกปักหมุด</>
          : <><Pin size={12} aria-hidden="true" /> ปักหมุด</>}
      </button>

      <button type="button" className="btn-ghost" disabled={pending}
              onClick={async () => {
                const ok = await confirm({
                  tone: 'danger',
                  title: 'ลบประกาศนี้ถาวร?',
                  message: <>ประกาศ <strong>“{announcement.title}”</strong> และรูปหรือไฟล์ที่แนบไว้จะหายไปทั้งหมด กู้คืนไม่ได้</>,
                  confirmLabel: 'ลบประกาศ',
                })
                if (ok) run(() => deleteAnnouncementAction(announcement.id))
              }}
              style={{ padding: '0.45rem 0.8rem', fontSize: '0.78rem', minHeight: 40, color: 'var(--ember)', borderColor: 'color-mix(in oklab, var(--ember) 45%, transparent)' }}>
        <Trash2 size={12} aria-hidden="true" /> ลบ
      </button>

      {error && <span role="alert" style={{ fontSize: '0.78rem', color: 'var(--ember)' }}>{error}</span>}
    </div>
  )
}
