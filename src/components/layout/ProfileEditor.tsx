'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { Camera, X } from 'lucide-react'
import { updateProfileAction, type ProfileState } from '@/actions/profile'
import { createClient } from '@/lib/supabase/client'
import { AVATAR_BUCKET, AVATAR_SIZE, AVATAR_SOURCE_TYPES, MAX_AVATAR_SOURCE_BYTES } from '@/lib/profile/avatar'
import { Avatar } from './Avatar'
import type { SessionUser } from '@/types/app'

type Choice =
  | { kind: 'keep' }
  | { kind: 'remove' }
  | { kind: 'new'; blob: Blob; ext: 'webp' | 'jpg'; preview: string }

/** ตัดกลางเป็นสี่เหลี่ยมจัตุรัสแล้วย่อ — รูปจากมือถือหลาย MB เหลือไม่กี่สิบ KB */
async function toSquare(file: File): Promise<{ blob: Blob; ext: 'webp' | 'jpg' }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const side = Math.min(bitmap.width, bitmap.height)
  const out = Math.min(AVATAR_SIZE, side)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = out
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('เบราว์เซอร์นี้ย่อรูปไม่ได้')
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, out, out)
  bitmap.close()

  const encode = (type: string, quality: number) =>
    new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, quality))
  // Safari รุ่นเก่าเข้ารหัส webp ไม่ได้ จะคืน png มาแทน — ถอยไปใช้ jpg
  const webp = await encode('image/webp', 0.85)
  if (webp?.type === 'image/webp') return { blob: webp, ext: 'webp' }
  const jpg = await encode('image/jpeg', 0.88)
  if (!jpg) throw new Error('ย่อรูปไม่สำเร็จ')
  return { blob: jpg, ext: 'jpg' }
}

/**
 * กล่องแก้โปรไฟล์กลางจอ — เปิดจากเมนูโปรไฟล์บนแถบนำทาง
 * แก้ได้แค่รูป ชื่อ-นามสกุลและชื่อเล่นพี่ค่ายเป็นคนตั้ง (แสดงให้ดูอย่างเดียว)
 */
export function ProfileEditor({ user, open, onClose }: { user: SessionUser; open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const [choice, setChoice] = useState<Choice>({ kind: 'keep' })
  const [pickError, setPickError] = useState<string | null>(null)
  const [busyPicking, setBusyPicking] = useState(false)

  useEffect(() => {
    const d = ref.current
    if (open && !d?.open) {
      setChoice({ kind: 'keep' })
      setPickError(null)
      d?.showModal()
    }
    if (!open && d?.open) d.close()
  }, [open])

  useEffect(() => () => { if (choice.kind === 'new') URL.revokeObjectURL(choice.preview) }, [choice])

  const [state, action, pending] = useActionState<ProfileState, FormData>(async (prev, formData) => {
    let uploaded: string | null = null
    if (choice.kind === 'new') {
      uploaded = `${user.id}/${crypto.randomUUID()}.${choice.ext}`
      const { error } = await createClient().storage.from(AVATAR_BUCKET)
        .upload(uploaded, choice.blob, { contentType: choice.blob.type, cacheControl: '31536000', upsert: false })
      if (error) return { error: `อัปโหลดรูปไม่สำเร็จ: ${error.message}` }
      formData.set('avatar_path', uploaded)
    } else if (choice.kind === 'remove') {
      formData.set('avatar_path', '')
    }

    const res = await updateProfileAction(prev, formData)
    if (res?.error && uploaded) await createClient().storage.from(AVATAR_BUCKET).remove([uploaded])
    if (res?.ok) onClose()
    return res
  }, null)

  async function pick(files: FileList | null) {
    const file = files?.[0]
    if (input.current) input.current.value = ''
    if (!file) return
    setPickError(null)
    if (!AVATAR_SOURCE_TYPES.includes(file.type)) { setPickError('รับเฉพาะรูป JPG PNG WEBP GIF'); return }
    if (file.size > MAX_AVATAR_SOURCE_BYTES) { setPickError('รูปใหญ่เกินไป เลือกรูปที่เล็กกว่า 15 MB'); return }
    setBusyPicking(true)
    try {
      const { blob, ext } = await toSquare(file)
      setChoice({ kind: 'new', blob, ext, preview: URL.createObjectURL(blob) })
    } catch (e) {
      setPickError((e as Error).message || 'เปิดรูปนี้ไม่ได้ ลองรูปอื่น')
    } finally {
      setBusyPicking(false)
    }
  }

  // รูปที่เพิ่งเลือก (blob) มาก่อน · ไม่มีก็ใช้ลิงก์ชั่วคราวของรูปเดิม · เลือก "เอารูปออก" = ไม่แสดงอะไร
  const previewSrc = choice.kind === 'new' ? choice.preview : undefined
  const previewPath = choice.kind === 'keep' ? user.avatarSrc : null
  const hasImage = choice.kind === 'new' || (choice.kind === 'keep' && Boolean(user.avatarUrl))

  return (
    <dialog
      ref={ref}
      className="confirm profile-dialog"
      aria-labelledby="profile-title"
      onClose={onClose}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* โฟกัสแรกอยู่ที่ตัวกล่อง ไม่ใช่ปุ่มปิดหรือช่องกรอก — ไม่ขึ้นกรอบโฟกัสและแป้นพิมพ์มือถือไม่เด้งทันที */}
      <form action={action} className="confirm-card profile-card" tabIndex={-1} autoFocus>
        <button type="button" className="profile-close" aria-label="ปิด" onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </button>

        <h2 id="profile-title" className="confirm-title" style={{ marginTop: 0 }}>แก้ไขโปรไฟล์</h2>

        <div className="profile-avatar-edit">
          <Avatar src={previewSrc ?? previewPath} name={user.nickname || user.displayName || user.email} size={112} />
          <button type="button" className="profile-avatar-btn" onClick={() => input.current?.click()}
                  disabled={busyPicking || pending} aria-label="เปลี่ยนรูปโปรไฟล์">
            <Camera size={17} aria-hidden="true" />
          </button>
          <input ref={input} type="file" accept={AVATAR_SOURCE_TYPES.join(',')} className="sr-only"
                 tabIndex={-1} aria-hidden="true" onChange={e => pick(e.target.files)} />
        </div>

        <div className="profile-avatar-actions">
          <button type="button" className="profile-link" onClick={() => input.current?.click()} disabled={busyPicking || pending}>
            {busyPicking ? 'กำลังเตรียมรูป…' : hasImage ? 'เปลี่ยนรูป' : 'เพิ่มรูปโปรไฟล์'}
          </button>
          {hasImage && (
            <button type="button" className="profile-link profile-link--muted" disabled={pending}
                    onClick={() => setChoice(choice.kind === 'new' && !user.avatarUrl ? { kind: 'keep' } : { kind: 'remove' })}>
              เอารูปออก
            </button>
          )}
          {choice.kind === 'remove' && (
            <button type="button" className="profile-link profile-link--muted" onClick={() => setChoice({ kind: 'keep' })}>
              เก็บรูปเดิมไว้
            </button>
          )}
        </div>
        {pickError && <p role="alert" className="profile-error">{pickError}</p>}

        <dl className="profile-info">
          <div>
            <dt>ชื่อ-นามสกุล</dt>
            <dd>{user.displayName || '—'}</dd>
          </div>
          <div>
            <dt>ชื่อเล่น</dt>
            <dd>{user.nickname || '—'}</dd>
          </div>
          <div>
            <dt>อีเมล</dt>
            <dd className="profile-info-mono">{user.email}</dd>
          </div>
        </dl>

        {state?.error && <p role="alert" className="profile-error">{state.error}</p>}

        <div className="confirm-actions">
          <button type="button" className="confirm-btn confirm-btn--cancel" onClick={onClose} disabled={pending}>ยกเลิก</button>
          <button type="submit" className="confirm-btn confirm-btn--ok" disabled={pending || busyPicking}>
            {pending ? 'กำลังบันทึก…' : 'บันทึกรูป'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
