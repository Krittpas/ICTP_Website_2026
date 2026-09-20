'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { FileText, ImagePlus, X } from 'lucide-react'
import {
  createAnnouncementAction,
  updateAnnouncementAction,
  type AnnouncementState,
} from '@/actions/announcements'
import { createClient } from '@/lib/supabase/client'
import {
  ACCEPTED_TYPES, ANNOUNCEMENT_BUCKET, MAX_ATTACHMENTS, MAX_FILE_BYTES,
  attachmentUrl, formatBytes, isImage, storageKeyFor, type Attachment,
} from '@/lib/announcements/attachments'
import type { Announcement } from '@/types/app'

interface Props {
  /** ส่งประกาศเดิมมา = โหมดแก้ไข ไม่ส่ง = โหมดเขียนใหม่ */
  announcement?: Announcement
  /** ชื่อที่ใช้เมื่อเว้นช่อง "ประกาศจาก" ว่าง — ชื่อพี่ค่ายที่กำลังเขียน */
  defaultFrom: string
  onDone?: () => void
}

/** ไฟล์ที่เลือกไว้แต่ยังไม่อัปโหลด — อัปโหลดตอนกดบันทึก ไม่ทิ้งไฟล์ค้างถ้าเปลี่ยนใจ */
interface Picked { id: string; file: File; preview: string | null }

/** อัปโหลดตรงจากเบราว์เซอร์ไป Storage ด้วยสิทธิ์ของพี่ค่ายเอง (policy ใน migration 011) */
async function upload(file: File): Promise<Attachment> {
  const supabase = createClient()
  const path = storageKeyFor(file.name)
  const { error } = await supabase.storage.from(ANNOUNCEMENT_BUCKET)
    .upload(path, file, { contentType: file.type, cacheControl: '31536000', upsert: false })
  if (error) throw new Error(`อัปโหลด "${file.name}" ไม่สำเร็จ: ${error.message}`)
  return { path, name: file.name, type: file.type, size: file.size }
}

export function AnnouncementForm({ announcement, defaultFrom, onDone }: Props) {
  const isEdit = announcement !== undefined
  const key = announcement?.id ?? 'new'
  const [kept, setKept] = useState<Attachment[]>(announcement?.attachments ?? [])
  const [picked, setPicked] = useState<Picked[]>([])
  const [pickError, setPickError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  // URL พรีวิวที่ยังใช้อยู่ — คืนหน่วยความจำทีละไฟล์ตอนเอาออก และทั้งหมดตอนปิดฟอร์ม
  const previews = useRef(new Set<string>())

  function unpick(id?: string) {
    setPicked(list => {
      for (const p of list) {
        if ((id === undefined || p.id === id) && p.preview) {
          URL.revokeObjectURL(p.preview)
          previews.current.delete(p.preview)
        }
      }
      return id === undefined ? [] : list.filter(p => p.id !== id)
    })
  }

  const [state, action, pending] = useActionState<AnnouncementState, FormData>(async (prev, formData) => {
    const results = await Promise.allSettled(picked.map(p => upload(p.file)))
    const uploaded = results.flatMap(r => r.status === 'fulfilled' ? [r.value] : [])
    const failed = results.find(r => r.status === 'rejected')
    if (failed) {
      // อัปโหลดไม่ครบ = ไม่บันทึก และลบไฟล์ที่ขึ้นไปแล้วทิ้ง ไม่ให้ค้างใน Storage
      if (uploaded.length) await createClient().storage.from(ANNOUNCEMENT_BUCKET).remove(uploaded.map(a => a.path))
      return { error: ((failed as PromiseRejectedResult).reason as Error).message }
    }
    formData.set('attachments', JSON.stringify([...kept, ...uploaded]))
    return (isEdit ? updateAnnouncementAction : createAnnouncementAction)(prev, formData)
  }, null)

  // แก้เสร็จปิดฟอร์มเอง ส่วนโหมดเขียนใหม่ค้างไว้พร้อมข้อความยืนยัน และล้างไฟล์ที่แนบไว้
  useEffect(() => {
    if (!state?.success) return
    if (isEdit) onDone?.()
    else { unpick(); setKept([]) }
  }, [state, isEdit, onDone])

  useEffect(() => {
    const urls = previews.current
    return () => urls.forEach(url => URL.revokeObjectURL(url))
  }, [])

  function add(files: FileList | null) {
    if (!files) return
    setPickError(null)
    const room = MAX_ATTACHMENTS - kept.length - picked.length
    const next: Picked[] = []
    for (const file of Array.from(files)) {
      if (next.length >= room) { setPickError(`แนบได้สูงสุด ${MAX_ATTACHMENTS} ไฟล์ต่อประกาศ`); break }
      if (!ACCEPTED_TYPES.includes(file.type)) { setPickError(`"${file.name}" เป็นไฟล์ชนิดที่ไม่รองรับ`); continue }
      if (file.size > MAX_FILE_BYTES) { setPickError(`"${file.name}" ใหญ่เกิน ${formatBytes(MAX_FILE_BYTES)}`); continue }
      const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : null
      if (preview) previews.current.add(preview)
      next.push({ id: crypto.randomUUID(), file, preview })
    }
    setPicked(list => [...list, ...next])
    if (input.current) input.current.value = ''
  }

  const count = kept.length + picked.length

  return (
    <form action={action} className="panel" style={{
      padding: '1.4rem', borderLeft: '3px solid var(--brass)',
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <span className="stamp" style={{ fontSize: '0.72rem', color: 'var(--brass)' }}>
        {isEdit ? 'แก้ไขประกาศ' : 'เขียนประกาศใหม่'}
      </span>

      {isEdit && <input type="hidden" name="id" value={announcement.id} />}

      <div>
        <label htmlFor={`t-${key}`} className="label">หัวข้อ</label>
        <input
          id={`t-${key}`} name="title" required maxLength={200}
          defaultValue={announcement?.title ?? ''} className="field"
          placeholder="สูงสุด 200 ตัวอักษร"
        />
      </div>

      <div>
        <label htmlFor={`b-${key}`} className="label">เนื้อหา</label>
        <textarea
          id={`b-${key}`} name="body" required maxLength={5000} rows={5}
          defaultValue={announcement?.body ?? ''} className="field"
          placeholder="สูงสุด 5000 ตัวอักษร" style={{ resize: 'vertical' }}
        />
      </div>

      <div>
        <label htmlFor={`f-${key}`} className="label">ประกาศจาก</label>
        <input
          id={`f-${key}`} name="from" maxLength={100}
          defaultValue={announcement?.creator_display_name ?? ''} className="field"
          placeholder={`เช่น ฝ่ายสันทนาการ · เว้นว่าง = ${defaultFrom}`}
        />
      </div>

      {/* ── รูปภาพและไฟล์แนบ ── */}
      <div>
        <span className="label">รูปภาพและไฟล์แนบ ({count}/{MAX_ATTACHMENTS})</span>

        {count > 0 && (
          <ul className="attach-picker">
            {kept.map(a => (
              <AttachChip key={a.path} name={a.name} size={a.size}
                          preview={isImage(a) ? attachmentUrl(a) : null}
                          onRemove={() => setKept(list => list.filter(x => x.path !== a.path))} />
            ))}
            {picked.map(p => (
              <AttachChip key={p.id} name={p.file.name} size={p.file.size} preview={p.preview} fresh
                          onRemove={() => unpick(p.id)} />
            ))}
          </ul>
        )}

        {count < MAX_ATTACHMENTS && (
          <label
            className="attach-drop" data-dragging={dragging}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); add(e.dataTransfer.files) }}
          >
            <ImagePlus size={20} aria-hidden="true" />
            <span>
              <strong>เลือกรูปภาพหรือไฟล์</strong> หรือลากมาวางตรงนี้
              <small>รูป JPG PNG WEBP GIF · PDF Word Excel PowerPoint ZIP · ไฟล์ละไม่เกิน {formatBytes(MAX_FILE_BYTES)}</small>
            </span>
            <input
              ref={input} type="file" multiple accept={ACCEPTED_TYPES.join(',')}
              className="sr-only" onChange={e => add(e.target.files)}
            />
          </label>
        )}

        {pickError && <p role="alert" style={{ margin: '0.5rem 0 0', fontSize: '0.84rem', color: 'var(--ember)' }}>{pickError}</p>}
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', fontSize: '0.88rem' }}>
        <input
          type="checkbox" name="is_pinned" defaultChecked={announcement?.is_pinned ?? false}
          style={{ width: 17, height: 17, accentColor: 'var(--brass)' }}
        />
        ปักหมุดไว้บนสุด
      </label>

      {state?.error && (
        <p role="alert" style={{ margin: 0, fontSize: '0.86rem', color: 'var(--ember)' }}>{state.error}</p>
      )}
      {state?.success && !isEdit && (
        <p role="status" style={{ margin: 0, fontSize: '0.86rem', color: 'var(--neon)' }}>✓ ติดประกาศขึ้นกระดานแล้ว</p>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button type="submit" className="btn-brass" disabled={pending}>
          {pending
            ? picked.length > 0 ? 'กำลังอัปโหลดไฟล์…' : 'กำลังบันทึก…'
            : isEdit ? 'บันทึกการแก้ไข' : 'ติดประกาศ'}
        </button>
        {isEdit && (
          <button type="button" className="btn-ghost" onClick={onDone} disabled={pending}>ยกเลิก</button>
        )}
      </div>
    </form>
  )
}

function AttachChip({ name, size, preview, fresh, onRemove }: {
  name: string; size: number; preview: string | null; fresh?: boolean; onRemove: () => void
}) {
  return (
    <li className="attach-chip" data-fresh={fresh}>
      {preview
        // eslint-disable-next-line @next/next/no-img-element -- blob: URL ของไฟล์ที่ยังไม่อัปโหลด next/image ใช้ไม่ได้
        ? <img src={preview} alt="" />
        : <span className="attach-chip-icon"><FileText size={18} aria-hidden="true" /></span>}
      <span className="attach-chip-text">
        <span>{name}</span>
        <small>{formatBytes(size)}{fresh ? ' · ยังไม่อัปโหลด' : ''}</small>
      </span>
      <button type="button" className="attach-chip-remove" aria-label={`เอา ${name} ออก`} onClick={onRemove}>
        <X size={14} aria-hidden="true" />
      </button>
    </li>
  )
}
