'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { Camera, X } from 'lucide-react'
import { updateProfileAction, type ProfileState } from '@/actions/profile'
import { createClient } from '@/lib/supabase/client'
import { AVATAR_BUCKET, AVATAR_SIZE, AVATAR_SOURCE_TYPES, MAX_AVATAR_SOURCE_BYTES } from '@/lib/profile/avatar'
import { COWHAND_LABEL, DEPUTY_LABEL, campTitle, generationOf, isCowhand, isDeputyRank } from '@/lib/profile/titles'
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

const fmtDate = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium' }).format(new Date(iso)) : '—'

/**
 * แถบล่างของหนังสือเดินทางจริง (machine-readable zone)
 * เครื่องอ่านรับเฉพาะ A–Z 0–9 กับ '<' ชื่อไทยจึงลงตรงนี้ไม่ได้ — ใช้อีเมลกับรหัสแทน
 * ของเราเป็นการตกแต่งล้วน ๆ ไม่มีใครอ่านจริง จึงซ่อนจาก screen reader ทั้งแถบ
 */
function mrz(user: SessionUser): [string, string] {
  const pad = (s: string, n: number) => s.slice(0, n).padEnd(n, '<')
  const code = user.role === 'admin'
    ? (isDeputyRank(user.deputyRank) ? user.deputyRank : 'deputy')
    : (isCowhand(user.cowhand) ? user.cowhand : 'drifter')
  const gen = generationOf(user.grade)
  const handle = (user.email.split('@')[0] || 'unknown').toUpperCase()
  const seat = user.cityId && user.seatIndex
    ? `C${String(user.cityId).padStart(2, '0')}S${String(user.seatIndex).padStart(2, '0')}`
    : 'UNSEATED'

  return [
    pad(`P<ICTP<${code.toUpperCase()}${gen ?? ''}`, 40),
    pad(`${handle}<<${seat}<<CAMP2026`, 40),
  ]
}

/**
 * หนังสือเดินทางประจำตัว — เปิดจากปุ่ม "ดูโปรไฟล์" บนเมนูโปรไฟล์
 *
 * หน้าซ้ายคือหน้ารูป หน้าขวาคือหน้าข้อมูล เหมือนหนังสือเดินทางจริงที่กางออก
 * แก้ได้แค่รูปของตัวเอง — ชื่อ ฉายา และยศพี่ค่ายเป็นคนตั้ง (migration 014 · 020)
 * ปุ่มบันทึกจะโผล่ก็ต่อเมื่อเลือกรูปใหม่หรือสั่งเอารูปออกแล้วเท่านั้น
 */
export function ProfilePassport({ user, open, onClose }: { user: SessionUser; open: boolean; onClose: () => void }) {
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

  // รูปที่เพิ่งเลือก (blob) มาก่อน · ไม่มีก็ใช้ลิงก์ชั่วคราวของรูปเดิม · "เอารูปออก" = ไม่แสดงอะไร
  const previewSrc = choice.kind === 'new' ? choice.preview : undefined
  const previewPath = choice.kind === 'keep' ? user.avatarSrc : null
  const hasImage = choice.kind === 'new' || (choice.kind === 'keep' && Boolean(user.avatarUrl))
  const dirty = choice.kind !== 'keep'

  const name = user.displayName || user.nickname || user.email
  const title = campTitle(user)
  const seated = Boolean(user.cityId && user.seatIndex)
  const [mrzTop, mrzBottom] = mrz(user)

  return (
    <dialog
      ref={ref}
      className="confirm passport-dialog"
      aria-labelledby="passport-title"
      onClose={onClose}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* โฟกัสแรกอยู่ที่ตัวเล่ม ไม่ใช่ปุ่มปิด — ไม่ขึ้นกรอบโฟกัสตอนเปิด */}
      <form action={action} className="passport" tabIndex={-1} autoFocus>
        <button type="button" className="profile-close passport-close" aria-label="ปิด" onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </button>

        <div className="passport-spread">
          {/* ── หน้าซ้าย: หน้ารูป ── */}
          <section className="passport-page passport-page--photo">
            <p className="passport-issuer">ICTP CAMP 2026</p>
            <p className="passport-issuer passport-issuer--sub">CYBERING SALOON VALLEY</p>

            <div className="passport-photo">
              <Avatar src={previewSrc ?? previewPath} name={user.nickname || user.displayName || user.email} size={128} />
              <button type="button" className="profile-avatar-btn passport-photo-btn"
                      onClick={() => input.current?.click()}
                      disabled={busyPicking || pending} aria-label="เปลี่ยนรูปประจำตัว">
                <Camera size={17} aria-hidden="true" />
              </button>
              <input ref={input} type="file" accept={AVATAR_SOURCE_TYPES.join(',')} className="sr-only"
                     tabIndex={-1} aria-hidden="true" onChange={e => pick(e.target.files)} />
            </div>

            <h2 id="passport-title" className="passport-name">{name}</h2>
            {user.nickname && user.displayName && <p className="passport-alias">&ldquo;{user.nickname}&rdquo;</p>}
            <p className="passport-title-line">{title}</p>

            <div className="passport-photo-actions">
              <button type="button" className="profile-link" onClick={() => input.current?.click()} disabled={busyPicking || pending}>
                {busyPicking ? 'กำลังเตรียมรูป…' : hasImage ? 'เปลี่ยนรูป' : 'เพิ่มรูปประจำตัว'}
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
          </section>

          {/* ── หน้าขวา: หน้าข้อมูล ── */}
          <section className="passport-page passport-page--data">
            <div className="passport-head">
              <span className="passport-doc">หนังสือเข้าเมือง</span>
              <span className="passport-serial">NO. {(user.email.split('@')[0] || '00000').toUpperCase()}</span>
            </div>

            {/* ตราประทับ — เอียงทับหน้าข้อมูลเหมือนโดนปั๊มมาจริง */}
            <span className={`passport-stamp${seated ? '' : ' passport-stamp--pending'}`} aria-hidden="true">
              {user.role === 'admin' ? 'ผ่านได้ทุกด่าน' : seated ? 'ตรวจผ่านแล้ว' : 'รอตรวจ'}
            </span>

            <dl className="passport-fields">
              <Field label="ชื่อ-นามสกุล" value={user.displayName || '—'} />
              <Field label="ชื่อเล่น" value={user.nickname || '—'} />
              {user.role === 'admin' ? (
                <Field label="ยศ" value={isDeputyRank(user.deputyRank) ? DEPUTY_LABEL[user.deputyRank] : 'ยังไม่ตั้งยศ'} />
              ) : (
                <>
                  <Field label="ฉายา" value={isCowhand(user.cowhand) ? COWHAND_LABEL[user.cowhand] : 'ยังไม่ตั้ง'} />
                  <Field label="รุ่น" value={generationOf(user.grade) ? `#${generationOf(user.grade)} · ม.${user.grade}` : 'ยังไม่ตั้ง'} mono />
                </>
              )}
              <Field
                label="เมือง"
                value={user.role === 'admin' ? 'ทุกเมือง' : user.cityId ? `เมือง ${String(user.cityId).padStart(2, '0')}` : 'ยังไม่ถูกจัดลงเมือง'}
              />
              {user.role !== 'admin' && (
                <Field label="หมายเลขประจำตัว" value={user.seatIndex ? `#${user.seatIndex}` : '—'} mono />
              )}
              <Field label="อีเมล" value={user.email} mono />
              <Field label="ออกหนังสือเมื่อ" value={fmtDate(user.createdAt)} />
            </dl>

            <p className="passport-note">
              ชื่อ ฉายา และที่นั่งตั้งโดยพี่ค่าย · เปลี่ยนเองได้แค่รูปประจำตัว
            </p>
          </section>
        </div>

        {/* ── แถบเครื่องอ่าน ── */}
        <div className="passport-mrz" aria-hidden="true">
          <span>{mrzTop}</span>
          <span>{mrzBottom}</span>
        </div>

        {pickError && <p role="alert" className="profile-error passport-error">{pickError}</p>}
        {state?.error && <p role="alert" className="profile-error passport-error">{state.error}</p>}

        {/* ปุ่มบันทึกโผล่เฉพาะตอนที่มีอะไรให้บันทึกจริง — ปกติเล่มนี้ไว้ดูเฉย ๆ */}
        {dirty && (
          <div className="passport-actions">
            <button type="button" className="confirm-btn confirm-btn--cancel" disabled={pending}
                    onClick={() => setChoice({ kind: 'keep' })}>
              ยกเลิก
            </button>
            <button type="submit" className="confirm-btn confirm-btn--ok" disabled={pending || busyPicking}>
              {pending ? 'กำลังบันทึก…' : 'บันทึกรูป'}
            </button>
          </div>
        )}
      </form>
    </dialog>
  )
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="passport-field">
      <dt>{label}</dt>
      <dd className={mono ? 'passport-mono' : undefined}>{value}</dd>
    </div>
  )
}
