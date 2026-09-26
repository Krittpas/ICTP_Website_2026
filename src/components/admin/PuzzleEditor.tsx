'use client'

import { useActionState, useEffect, useRef, useState, useTransition } from 'react'
import { Check, Copy, Dices, DoorClosed, DoorOpen, ImagePlus, Trash2, TriangleAlert } from 'lucide-react'
import { getPuzzleForEditAction, regenerateSecretCodesAction, setSeatActiveAction, upsertPuzzleAction } from '@/actions/admin'
import type { PuzzleForEdit } from '@/lib/puzzles/edit'
import { createClient } from '@/lib/supabase/client'
import { formatBytes, storageKeyFor } from '@/lib/storage'
import { MAX_PUZZLE_IMAGE_BYTES, PUZZLE_BUCKET, PUZZLE_IMAGE_TYPES } from '@/lib/puzzles/media'
import { SECRET_CODE_RULE } from '@/lib/puzzles/secret-code'
import { useConfirm } from '@/components/layout/ConfirmDialog'
import type { City } from '@/types/app'

type State = { ok?: true; error?: string } | null

/** รูปโจทย์ในฟอร์ม — เก็บรูปเดิม · เอาออก · หรือรูปใหม่ที่ยังไม่อัปโหลด */
type ImageChoice =
  | { kind: 'keep' }
  | { kind: 'remove' }
  | { kind: 'new'; file: File; preview: string }

const BLANK = { title: '', prompt: '', hint: '' }

/**
 * แก้ปริศนารายข้อ
 *
 * เลือกเมือง/คาวบอยแล้วดึงปริศนาเดิมมาเติมให้ แก้ช่องไหนก็ได้โดยช่องอื่นไม่หาย
 * เฉลยถูกแฮชในฐานข้อมูลและไม่เคยถูกอ่านกลับมา — ช่องเฉลยว่างเสมอ เว้นว่าง = ไม่เปลี่ยน
 * รูปโจทย์อยู่ในที่เก็บส่วนตัว น้องเห็นได้เฉพาะเมื่อถึงตาตัวเอง (migration 012)
 */
export function PuzzleEditor({ cities }: { cities: City[] }) {
  const [cityId, setCityId] = useState(cities[0]?.id ?? 1)
  const [seat, setSeat] = useState(1)
  const [loaded, setLoaded] = useState<PuzzleForEdit | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [fields, setFields] = useState(BLANK)
  const [image, setImage] = useState<ImageChoice>({ kind: 'keep' })
  const [pickError, setPickError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  // รหัสลับ: keep = ไม่แตะของเดิม · regenerate = สั่งฐานข้อมูลสุ่มใหม่ตอนกดบันทึก
  const [codeMode, setCodeMode] = useState<'keep' | 'regenerate'>('keep')
  const [copied, setCopied] = useState(false)
  const [bulkMsg, setBulkMsg] = useState<{ text: string; bad?: boolean } | null>(null)
  const [bulkPending, startBulk] = useTransition()
  const [seatMsg, setSeatMsg] = useState<{ text: string; bad?: boolean } | null>(null)
  const [seatPending, startSeat] = useTransition()
  const input = useRef<HTMLInputElement>(null)
  const confirm = useConfirm()

  // ดึงปริศนาเดิมทุกครั้งที่เปลี่ยนที่นั่ง — ตอบกลับช้าแล้วผู้ใช้เปลี่ยนไปที่อื่นแล้ว = ทิ้งผลเก่า
  useEffect(() => {
    let current = true
    setLoaded(null)
    setLoadError(null)
    getPuzzleForEditAction(cityId, seat).then(res => {
      if (!current) return
      if ('error' in res) { setLoadError(res.error); return }
      setLoaded(res)
      setFields({ title: res.title, prompt: res.prompt, hint: res.hint })
      setImage({ kind: 'keep' })
      setCodeMode('keep')
      setCopied(false)
    })
    return () => { current = false }
  }, [cityId, seat, reloadKey])

  // ผลการปิด/เปิดที่นั่งเป็นของที่นั่งนั้น ย้ายที่นั่งเมื่อไหร่ก็ทิ้ง (แต่ไม่ทิ้งตอนโหลดซ้ำหลังเพิ่งกด)
  useEffect(() => setSeatMsg(null), [cityId, seat])

  // คืนหน่วยความจำของรูปพรีวิวเมื่อเปลี่ยนรูปหรือปิดฟอร์ม
  useEffect(() => () => { if (image.kind === 'new') URL.revokeObjectURL(image.preview) }, [image])

  const [state, action, pending] = useActionState<State, FormData>(async (prev, formData) => {
    let uploaded: string | null = null
    if (image.kind === 'new') {
      uploaded = storageKeyFor(image.file.name)
      const { error } = await createClient().storage.from(PUZZLE_BUCKET)
        .upload(uploaded, image.file, { contentType: image.file.type, upsert: false })
      if (error) return { error: `อัปโหลดรูปไม่สำเร็จ: ${error.message}` }
      formData.set('media_path', uploaded)
    } else if (image.kind === 'remove') {
      formData.set('media_path', '')
    }

    // ไม่ส่งช่องนี้ = ไม่แตะรหัสเดิม · ส่งค่าว่าง = ฐานข้อมูลสุ่มใหม่ให้
    if (codeMode === 'regenerate') formData.set('secret_code', '')

    const res = await upsertPuzzleAction(prev, formData)
    if (res.error && uploaded) {
      // บันทึกไม่ผ่าน รูปที่เพิ่งอัปโหลดไม่มีปริศนาไหนใช้ ลบทิ้ง
      await createClient().storage.from(PUZZLE_BUCKET).remove([uploaded])
    }
    if (res.ok) setReloadKey(k => k + 1)
    return res.error ? { error: res.error } : { ok: true }
  }, null)

  function pick(files: FileList | null) {
    const file = files?.[0]
    if (input.current) input.current.value = ''
    if (!file) return
    setPickError(null)
    if (!PUZZLE_IMAGE_TYPES.includes(file.type)) { setPickError('รับเฉพาะรูป JPG PNG WEBP GIF'); return }
    if (file.size > MAX_PUZZLE_IMAGE_BYTES) { setPickError(`รูปใหญ่เกิน ${formatBytes(MAX_PUZZLE_IMAGE_BYTES)}`); return }
    setImage({ kind: 'new', file, preview: URL.createObjectURL(file) })
  }

  const set = (k: keyof typeof BLANK) =>
    (e: { target: { value: string } }) => setFields(f => ({ ...f, [k]: e.target.value }))

  async function copyCode() {
    if (!loaded?.secretCode) return
    try {
      await navigator.clipboard.writeText(loaded.secretCode)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  /** สุ่มรหัสใหม่ให้ทุกข้อรวดเดียว — ข้อที่ไขผ่านแล้วถูกข้ามในฐานข้อมูล */
  async function regenerateAll() {
    const ok = await confirm({
      tone: 'danger',
      title: 'สุ่มรหัสลับใหม่ทุกข้อ?',
      message: <>รหัสลับของทุกข้อที่ยัง<strong>ไม่มีใครไขผ่าน</strong>จะถูกแทนที่ด้วยรหัสสุ่มชุดใหม่ ย้อนกลับไม่ได้<br />
                 ข้อที่ไขผ่านไปแล้วไม่ถูกแตะ เพราะน้องจดรหัสเดิมไปใช้กับเครื่องถอดรหัสแล้ว</>,
      confirmLabel: 'สุ่มใหม่ทุกข้อ',
    })
    if (!ok) return
    setBulkMsg(null)
    startBulk(async () => {
      const res = await regenerateSecretCodesAction('สุ่มรหัสลับใหม่ทุกข้อ')
      setBulkMsg(res.error ? { text: res.error, bad: true } : { text: res.message ?? 'สุ่มรหัสใหม่แล้ว' })
      if (!res.error) setReloadKey(k => k + 1)
    })
  }

  /**
   * ปิดที่นั่งที่ไม่มีคนนั่ง — ไม่อย่างนั้นโซ่ทั้งเมืองค้างอยู่ตรงนี้ถาวร
   * ต่างจาก "ปลดที่นั่ง" ตรงที่ไม่บันทึกเป็นการไขผ่านของคนที่ไม่มีตัวตน
   */
  async function toggleSeat() {
    if (!loaded?.exists) return
    const closing = loaded.isActive
    const ok = await confirm(closing
      ? {
          tone: 'danger', title: `ปิดที่นั่งคาวบอย #${seat}?`, confirmLabel: 'ปิดที่นั่ง',
          message: <>โซ่จะข้ามที่นั่งนี้ไปคนถัดไปทันที และปริศนาข้อนี้จะไม่ถูกนับในจำนวนทั้งค่าย<br />
            {loaded.owner
              ? <><strong>{loaded.owner}</strong> นั่งอยู่ที่นี่ — จะไม่เห็นปริศนาอีก
                  และ<strong>จะไม่ได้รหัสลับ</strong> จึงตามหาพี่รหัสไม่ได้<br />
                  ถ้าน้องคนนี้อยู่ในค่ายด้วย ให้ใช้ <strong>&ldquo;ปลดที่นั่งที่ค้าง&rdquo;</strong> แทน
                  เพราะวิธีนั้นให้รหัสลับกับน้องไปด้วย</>
              : 'ที่นั่งนี้ยังไม่มีใครนั่ง — ปิดได้เลย'}</>,
        }
      : {
          title: `เปิดที่นั่งคาวบอย #${seat} กลับ?`, confirmLabel: 'เปิดที่นั่ง',
          message: 'โซ่จะวนกลับมาหยุดที่ที่นั่งนี้ ถ้ายังไม่มีใครไขผ่าน',
        })
    if (!ok) return
    setSeatMsg(null)
    startSeat(async () => {
      const res = await setSeatActiveAction(cityId, seat, !closing,
        closing ? 'ปิดที่นั่งที่ไม่มีคนนั่ง' : 'เปิดที่นั่งกลับ')
      setSeatMsg(res.error ? { text: res.error, bad: true } : { text: res.message ?? 'บันทึกแล้ว' })
      if (!res.error) setReloadKey(k => k + 1)
    })
  }

  const shownImage =
    image.kind === 'new' ? image.preview
    : image.kind === 'keep' ? loaded?.mediaUrl ?? null
    : null
  const hadImage = Boolean(loaded?.mediaPath)

  return (
    <section className="panel" style={{ padding: '1.4rem' }}>
      <span className="stamp" style={{ fontSize: '0.72rem', color: 'var(--neon)' }}>คลังปริศนา</span>

      <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: '1rem' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flexGrow: 1, minWidth: 160 }}>
            <label htmlFor="pe-city" className="label">เมือง</label>
            <select id="pe-city" name="city_id" className="field" value={cityId} onChange={e => setCityId(Number(e.target.value))}>
              {cities.map(c => (
                <option key={c.id} value={c.id}>{String(c.id).padStart(2, '0')} · {c.name_en}</option>
              ))}
            </select>
          </div>
          <div style={{ width: 150 }}>
            <label htmlFor="pe-seat" className="label">คาวบอย</label>
            <select id="pe-seat" name="seat_index" className="field" value={seat} onChange={e => setSeat(Number(e.target.value))}>
              {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>คาวบอย #{n}</option>)}
            </select>
          </div>
        </div>

        <p role="status" style={{ margin: 0, fontSize: '0.84rem', color: loadError ? 'var(--ember)' : 'var(--muted)' }}>
          {loadError ?? (!loaded ? 'กำลังโหลดปริศนาเดิม…'
            : !loaded.exists ? 'ยังไม่มีปริศนาของคาวบอยคนนี้ — กรอกเพื่อสร้างใหม่ (ต้องใส่เฉลย)'
            : loaded.isSolved ? 'แก้ปริศนาเดิม · ⚠ คาวบอยคนนี้ไขผ่านไปแล้ว'
            : 'แก้ปริศนาเดิม · เปลี่ยนเฉพาะช่องที่ต้องการได้เลย')}
        </p>

        {/* ── ที่นั่งนี้เปิดอยู่ไหม · ใครนั่ง ── */}
        {loaded?.exists && (
          <div className="seat-state" data-off={!loaded.isActive}>
            <span className="seat-state-text">
              <strong>{loaded.isActive ? 'ที่นั่งนี้เปิดอยู่' : 'ที่นั่งนี้ถูกปิดไว้'}</strong>
              <small>
                {loaded.owner
                  ? `${loaded.owner} นั่งอยู่ที่นี่`
                  : 'ยังไม่มีใครนั่ง — ถ้าปล่อยไว้ โซ่ทั้งเมืองจะค้างที่นี่'}
                {!loaded.isActive && ' · โซ่ข้ามที่นั่งนี้ไปแล้ว'}
              </small>
            </span>
            <button type="button" className="btn-ghost puzzle-edit-btn" disabled={seatPending || loaded.isSolved}
                    onClick={toggleSeat}
                    title={loaded.isSolved ? 'ที่นั่งที่ไขผ่านแล้วปิดไม่ได้' : undefined}>
              {loaded.isActive
                ? <><DoorClosed size={14} aria-hidden="true" /> {seatPending ? 'กำลังปิด…' : 'ปิดที่นั่งนี้'}</>
                : <><DoorOpen size={14} aria-hidden="true" /> {seatPending ? 'กำลังเปิด…' : 'เปิดที่นั่งกลับ'}</>}
            </button>
          </div>
        )}
        {seatMsg && (
          <p role="status" style={{ margin: 0, fontSize: '0.84rem', color: seatMsg.bad ? 'var(--ember)' : 'var(--neon)' }}>
            {seatMsg.text}
          </p>
        )}

        <div>
          <label htmlFor="pe-title" className="label">ชื่อด่าน</label>
          <input id="pe-title" name="title" required maxLength={200} className="field"
                 value={fields.title} onChange={set('title')} placeholder="เช่น สายโทรเลขที่ตายแล้ว" />
        </div>

        {/* ── รูปโจทย์ ── */}
        <div>
          <span className="label">รูปโจทย์</span>
          {shownImage ? (
            <div className="puzzle-edit-image">
              {/* eslint-disable-next-line @next/next/no-img-element -- ลิงก์ชั่วคราว/blob ของรูปโจทย์ */}
              <img src={shownImage} alt="ตัวอย่างรูปโจทย์" />
              <div className="puzzle-edit-image-bar">
                <span>{image.kind === 'new' ? `รูปใหม่ · ${formatBytes(image.file.size)} · ยังไม่บันทึก` : 'รูปปัจจุบัน'}</span>
                <span style={{ display: 'flex', gap: 6 }}>
                  <button type="button" className="btn-ghost puzzle-edit-btn" onClick={() => input.current?.click()}>
                    <ImagePlus size={14} aria-hidden="true" /> เปลี่ยนรูป
                  </button>
                  <button type="button" className="btn-ghost puzzle-edit-btn" style={{ color: 'var(--ember)' }}
                          onClick={() => setImage(image.kind === 'new' && !hadImage ? { kind: 'keep' } : { kind: 'remove' })}>
                    <Trash2 size={14} aria-hidden="true" /> เอารูปออก
                  </button>
                </span>
              </div>
            </div>
          ) : (
            <button type="button" className="attach-drop" style={{ width: '100%', background: 'none', font: 'inherit', textAlign: 'left' }}
                    onClick={() => input.current?.click()}>
              <ImagePlus size={20} aria-hidden="true" />
              <span>
                <strong>{image.kind === 'remove' ? 'รูปเดิมจะถูกเอาออกเมื่อบันทึก — เลือกรูปใหม่' : 'เลือกรูปโจทย์'}</strong>
                <small>JPG PNG WEBP GIF · ไม่เกิน {formatBytes(MAX_PUZZLE_IMAGE_BYTES)} · น้องเห็นรูปนี้เมื่อถึงตาตัวเองเท่านั้น</small>
              </span>
            </button>
          )}
          {image.kind === 'remove' && (
            <button type="button" className="btn-ghost puzzle-edit-btn" style={{ marginTop: 8 }} onClick={() => setImage({ kind: 'keep' })}>
              เก็บรูปเดิมไว้
            </button>
          )}
          <input ref={input} type="file" accept={PUZZLE_IMAGE_TYPES.join(',')} className="sr-only"
                 tabIndex={-1} aria-hidden="true" onChange={e => pick(e.target.files)} />
          {pickError && <p role="alert" style={{ margin: '0.5rem 0 0', fontSize: '0.84rem', color: 'var(--ember)' }}>{pickError}</p>}
        </div>

        <div>
          <label htmlFor="pe-hint" className="label">คำใบ้ (แสดงใต้รูป)</label>
          <textarea id="pe-hint" name="hint" rows={2} className="field" style={{ resize: 'vertical' }}
                    value={fields.hint} onChange={set('hint')} placeholder="เว้นว่างได้" />
        </div>

        <div>
          <label htmlFor="pe-prompt" className="label">ข้อความโจทย์เพิ่มเติม (ไม่บังคับ)</label>
          <textarea id="pe-prompt" name="prompt" rows={3} className="field" style={{ resize: 'vertical' }}
                    value={fields.prompt} onChange={set('prompt')} placeholder="ถ้าโจทย์อยู่ในรูปทั้งหมดแล้ว เว้นว่างได้" />
        </div>

        <div>
          <label htmlFor="pe-answer" className="label">
            เฉลย ({loaded?.exists ? 'ตั้งไว้แล้ว · เว้นว่าง = ไม่เปลี่ยน' : 'ต้องใส่'})
          </label>
          <input id="pe-answer" name="answer" className="field" autoComplete="off"
                 required={loaded ? !loaded.exists : false} style={{ fontFamily: 'var(--tech)' }} />
        </div>

        {/* ── รหัสลับที่จะได้รับ — ระบบสุ่มให้ ไม่ต้องคิดเอง ── */}
        <div>
          <span className="label">รหัสลับที่จะได้รับ</span>
          <div className="secret-code">
            {codeMode === 'regenerate' ? (
              <span className="secret-code-value secret-code-value--pending">
                จะสุ่มรหัสใหม่ให้ตอนกดบันทึก
              </span>
            ) : loaded?.exists ? (
              <span className="secret-code-value">{loaded.secretCode}</span>
            ) : (
              <span className="secret-code-value secret-code-value--pending">
                {loaded ? 'จะสุ่มให้ตอนกดบันทึก' : '…'}
              </span>
            )}

            <span className="secret-code-actions">
              {codeMode === 'keep' && loaded?.exists && (
                <button type="button" className="btn-ghost puzzle-edit-btn" onClick={copyCode}>
                  {copied ? <><Check size={14} aria-hidden="true" /> คัดลอกแล้ว</> : <><Copy size={14} aria-hidden="true" /> คัดลอก</>}
                </button>
              )}
              {loaded?.exists && (
                <button type="button" className="btn-ghost puzzle-edit-btn"
                        onClick={() => setCodeMode(m => (m === 'keep' ? 'regenerate' : 'keep'))}>
                  {codeMode === 'keep'
                    ? <><Dices size={14} aria-hidden="true" /> สุ่มรหัสใหม่</>
                    : <>เก็บรหัสเดิมไว้</>}
                </button>
              )}
            </span>
          </div>

          <p style={{ margin: '0.45rem 0 0', fontSize: '0.76rem', color: 'var(--muted)', lineHeight: 1.65 }}>
            {SECRET_CODE_RULE}
          </p>

          {codeMode === 'regenerate' && loaded?.isSolved && (
            <p role="alert" className="secret-code-warn">
              <TriangleAlert size={15} aria-hidden="true" style={{ flexShrink: 0 }} />
              คาวบอยคนนี้ไขผ่านและจดรหัสเดิมไปแล้ว — เปลี่ยนรหัสตอนนี้แปลว่ารหัสที่น้องถืออยู่ใช้ไม่ได้อีก
              ต้องแจ้งรหัสใหม่ให้น้องเอง
            </p>
          )}
        </div>

        {state?.error && <p role="alert" style={{ margin: 0, fontSize: '0.86rem', color: 'var(--ember)' }}>{state.error}</p>}
        {state?.ok && <p role="status" style={{ margin: 0, fontSize: '0.86rem', color: 'var(--neon)' }}>✓ บันทึกปริศนาแล้ว</p>}

        <button type="submit" className="btn-brass" disabled={pending || !loaded}>
          {pending ? (image.kind === 'new' ? 'กำลังอัปโหลดรูป…' : 'กำลังบันทึก…') : 'บันทึกปริศนา'}
        </button>

        <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--muted)', lineHeight: 1.65 }}>
          เฉลยถูกแฮชทันทีที่บันทึก ระบบอ่านกลับมาแสดงไม่ได้อีก
          ถ้าลืมว่าตั้งอะไรไว้ ต้องตั้งใหม่เท่านั้น
        </p>
      </form>

      {/* ── ทิ้งรหัสตัวอย่างจาก seed ทั้งชุดในคลิกเดียว ── */}
      <div style={{
        display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
        marginTop: '1.2rem', paddingTop: '1rem', borderTop: '1px dashed var(--line)',
      }}>
        <button type="button" className="btn-ghost" disabled={bulkPending} onClick={regenerateAll}
                style={{ padding: '0.5rem 1rem', minHeight: 40 }}>
          <Dices size={15} aria-hidden="true" /> {bulkPending ? 'กำลังสุ่ม…' : 'สุ่มรหัสลับใหม่ทุกข้อ'}
        </button>
        {bulkMsg
          ? <span role="status" style={{ fontSize: '0.84rem', color: bulkMsg.bad ? 'var(--ember)' : 'var(--neon)' }}>{bulkMsg.text}</span>
          : <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>ใช้ตอนตั้งค่าครั้งแรก เพื่อทิ้งรหัสตัวอย่างที่มากับ seed</span>}
      </div>
    </section>
  )
}
