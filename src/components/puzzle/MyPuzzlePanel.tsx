'use client'

import { useRef, useState, useTransition } from 'react'
import { Check, Copy, DoorClosed, Lock, Maximize2, TriangleAlert } from 'lucide-react'
import { submitAnswerAction } from '@/actions/puzzle'
import type { AnswerResult, MyPuzzle } from '@/types/app'

const MESSAGES: Record<string, string> = {
  incorrect:       'ยังไม่ใช่ ลองใหม่อีกครั้ง',
  locked:          'ยังไม่ถึงตาของคุณ',
  not_your_puzzle: 'นี่ไม่ใช่ปริศนาของคุณ',
  camp_closed:     'ระบบยังไม่เปิดให้ตอบ',
  rate_limited:    'ตอบผิดครบ 5 ครั้งแล้ว พัก 10 นาทีก่อนลองใหม่',
  unauthorized:    'กรุณาเข้าสู่ระบบใหม่',
  error:           'ระบบขัดข้อง ลองใหม่อีกครั้ง',
}

/**
 * รูปโจทย์ — จำลิงก์แรกไว้ตลอดอายุของรูปนั้น
 * หน้านี้รีเฟรชทุกครั้งที่เมืองไหนก็ตามขยับ (realtime) และแต่ละรอบได้ลิงก์ชั่วคราวใหม่
 * ถ้าเปลี่ยน src ตามทุกรอบ รูปจะโหลดใหม่และกระพริบ — จึงใช้ key เป็น path แทน
 */
function PuzzleImage({ url, title }: { url: string; title: string }) {
  const [src] = useState(url)
  return (
    <a href={src} target="_blank" rel="noopener noreferrer" className="puzzle-image" aria-label="เปิดรูปโจทย์ขนาดเต็ม">
      {/* eslint-disable-next-line @next/next/no-img-element -- ลิงก์ชั่วคราวจาก Storage ส่วนตัว ไม่ผ่านตัวย่อรูปของ Next */}
      <img src={src} alt={`รูปโจทย์: ${title}`} />
      <span className="puzzle-image-zoom" aria-hidden="true"><Maximize2 size={14} /> ขยาย</span>
    </a>
  )
}

/**
 * รหัสลับประจำตัว
 *
 * 18 อักขระ มีทั้งพิมพ์ใหญ่ พิมพ์เล็ก ตัวเลข และอักขระพิเศษ — พิมพ์ตามจากหน้าจอบนมือถือพลาดง่ายมาก
 * จึงต้องมีปุ่มคัดลอกเสมอ ถ้าเบราว์เซอร์คัดลอกให้ไม่ได้ (ไม่ใช่ https) จะเลือกข้อความให้แทน
 * น้องกดค้างแล้วสั่งคัดลอกเองได้
 */
function SecretCode({ code, note }: { code: string; note?: React.ReactNode }) {
  const [copied, setCopied] = useState(false)
  const value = useRef<HTMLDivElement>(null)

  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
    } catch {
      setCopied(false)
      const node = value.current
      if (!node) return
      const range = document.createRange()
      range.selectNodeContents(node)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
    }
  }

  return (
    <div className="code-box">
      <div className="stamp code-box-label">รหัสลับของคุณ</div>
      <div ref={value} className="code-box-value">{code}</div>
      <button type="button" className="btn-brass code-box-copy" onClick={copy}>
        {copied
          ? <><Check size={15} aria-hidden="true" /> คัดลอกแล้ว</>
          : <><Copy size={15} aria-hidden="true" /> คัดลอกรหัส</>}
      </button>
      {note && <p className="code-box-note">{note}</p>}
    </div>
  )
}

/**
 * รหัสที่เจ้าตัวไขผ่านมาแล้ว (migration 019)
 *
 * ผูกกับคน ไม่ใช่ที่นั่ง — ถูกย้ายที่นั่งกี่ครั้งรหัสเดิมก็ยังใช้กับเครื่องถอดรหัสได้
 * แสดงเฉพาะสถานะที่ยังไม่มีรหัสโชว์อยู่แล้ว จะได้ไม่มีรหัสสองชุดบนจอพร้อมกัน
 */
function EarnedCode({ code }: { code: string | null | undefined }) {
  if (!code) return null
  return (
    <div className="earned-code">
      <span className="stamp earned-code-label">รหัสลับที่คุณได้มาแล้ว</span>
      <code>{code}</code>
      <small>ใช้กับเครื่องถอดรหัสได้ตลอด แม้พี่ค่ายจะย้ายที่นั่งให้</small>
    </div>
  )
}

export function MyPuzzlePanel({ puzzle, campOpen, imageUrl }: { puzzle: MyPuzzle; campOpen: boolean; imageUrl?: string | null }) {
  const [result, setResult] = useState<AnswerResult | null>(null)
  const [pending, start] = useTransition()

  if (puzzle.status === 'unassigned' || puzzle.status === 'no_puzzle' || puzzle.status === 'unauthorized') {
    return (
      <>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.9rem', lineHeight: 1.8 }}>
          ยังไม่มีปริศนาสำหรับคุณ รอพี่ค่ายจัดเมืองและใส่โจทย์ก่อนนะ
        </p>
        {puzzle.status === 'no_puzzle' && <EarnedCode code={puzzle.earned_code} />}
      </>
    )
  }

  // ── พี่ค่ายปิดที่นั่งนี้ไว้ — โซ่ข้ามไปแล้ว ต้องบอกตรง ๆ ไม่ใช่ปล่อยให้เข้าใจว่ายังไม่มีโจทย์ ──
  if (puzzle.status === 'seat_closed') {
    return (
      <div style={{ textAlign: 'center', padding: '1rem 0' }}>
        <DoorClosed size={44} className="icon-center" color="var(--ember)" aria-hidden="true" strokeWidth={1.4} />
        <h2 style={{ fontFamily: 'var(--display)', fontSize: '1.25rem', color: 'var(--ember)', margin: '0.8rem 0 0.5rem' }}>
          ที่นั่งของคุณถูกปิดไว้
        </h2>
        <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: 1.8, color: 'var(--muted)' }}>
          พี่ค่ายปิดที่นั่งหมายเลขประจำตัว #{puzzle.seat_index} ไว้ โซ่ของเมืองจึงข้ามไปคนถัดไปแล้ว<br />
          {puzzle.earned_code
            ? 'รหัสลับที่คุณได้มาก่อนหน้านี้ยังใช้กับเครื่องถอดรหัสได้ตามปกติ'
            : 'ถ้าคุณยังอยู่ในค่ายและอยากได้รหัสลับ ทักพี่ค่ายได้เลย'}
        </p>
        <EarnedCode code={puzzle.earned_code} />
      </div>
    )
  }

  // ── ค่ายยังไม่เปิด: ฐานข้อมูลไม่ส่งโจทย์มาเลย แม้จะเป็นที่นั่งแรก ──
  if (puzzle.status === 'camp_closed') {
    return (
      <div style={{ textAlign: 'center', padding: '1rem 0' }}>
        <Lock size={44} className="icon-center" color="var(--muted)" aria-hidden="true" strokeWidth={1.4} />
        <h2 style={{ fontFamily: 'var(--display)', fontSize: '1.25rem', color: 'var(--muted)', margin: '0.8rem 0 0.5rem' }}>
          ค่ายยังไม่เปิด
        </h2>
        <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: 1.8, color: 'var(--muted)' }}>
          คุณคือหมายเลขประจำตัว #{puzzle.seat_index}<br />
          โจทย์จะโผล่ขึ้นมาเองเมื่อพี่ค่ายเปิดระบบและถึงตาคุณ
        </p>
        <EarnedCode code={puzzle.earned_code} />
      </div>
    )
  }

  // ── ยังไม่ถึงคิว: ฐานข้อมูลไม่ส่งข้อความโจทย์มาเลย ไม่มีอะไรให้แอบดู ──
  if (puzzle.status === 'locked') {
    return (
      <div style={{ textAlign: 'center', padding: '1rem 0' }}>
        <Lock size={44} className="icon-center" color="var(--muted)" aria-hidden="true" strokeWidth={1.4} />
        <h2 style={{ fontFamily: 'var(--display)', fontSize: '1.25rem', color: 'var(--muted)', margin: '0.8rem 0 0.5rem' }}>
          ประตูยังปิดอยู่
        </h2>
        <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: 1.8, color: 'var(--muted)' }}>
          คำสาปโซ่ตรวนคลายมาถึงหมายเลขประจำตัว #{puzzle.current_seat}<br />
          คุณคือหมายเลขประจำตัว #{puzzle.seat_index}
        </p>
        {puzzle.waiting_on && (
          <p style={{
            margin: '1rem 0 0', padding: '0.8rem 0.9rem', textAlign: 'left',
            background: 'var(--plank-2)', borderLeft: '3px solid var(--muted)',
            fontSize: '0.85rem', lineHeight: 1.7,
          }}>
            รอ <span style={{ color: 'var(--brass-lit)' }}>{puzzle.waiting_on}</span> ตอบให้ถูกก่อน
            โจทย์ของคุณจะโผล่ขึ้นมาเองโดยไม่ต้องรีเฟรช
          </p>
        )}
        <EarnedCode code={puzzle.earned_code} />
      </div>
    )
  }

  // ── ผ่านแล้ว ──
  if (puzzle.status === 'solved') {
    return (
      <div style={{ textAlign: 'center' }}>
        <Check size={40} className="icon-center" color="var(--neon)" aria-hidden="true" />
        <h2 style={{ fontFamily: 'var(--display)', fontSize: '1.3rem', color: 'var(--neon)', margin: '0.6rem 0 0.4rem' }}>
          โซ่ขยับแล้ว
        </h2>
        <p style={{ margin: '0 0 1.2rem', fontSize: '0.88rem', color: 'var(--muted)' }}>{puzzle.title}</p>

        <SecretCode
          code={puzzle.secret_code}
          note={<>ใช้กับเครื่องถอดรหัสที่สำนักงานนายอำเภอ<br />เปิดดูซ้ำได้ตลอดจากหน้านี้ ไม่ต้องจด</>}
        />
      </div>
    )
  }

  // ── ถึงตาเรา ──
  const shown = result ?? null
  const attemptsLeft = shown?.attempts_left ?? puzzle.attempts_left

  const puzzleId = puzzle.puzzle_id

  function onSubmit(formData: FormData) {
    const answer = String(formData.get('answer') ?? '')
    start(async () => setResult(await submitAnswerAction(puzzleId, answer)))
  }

  if (shown?.status === 'correct') {
    return (
      <div style={{ textAlign: 'center' }}>
        <Check size={40} className="icon-center" color="var(--neon)" aria-hidden="true" />
        <h2 style={{ fontFamily: 'var(--display)', fontSize: '1.3rem', color: 'var(--neon)', margin: '0.6rem 0 1rem' }}>
          ถูกต้อง
        </h2>
        <SecretCode
          code={shown.secret_code ?? ''}
          note={<>ใช้กับเครื่องถอดรหัสที่สำนักงานนายอำเภอ<br />เปิดดูซ้ำได้ตลอดจากหน้านี้ ไม่ต้องจด</>}
        />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <span className="stamp" style={{ fontSize: '0.72rem', color: 'var(--brass-lit)' }}>
          หมายเลขประจำตัว #{puzzle.seat_index} · ถึงตาคุณ
        </span>
        <span style={{ fontFamily: 'var(--tech)', fontSize: '0.72rem', color: 'var(--muted)' }}>
          เหลือ {Math.max(0, attemptsLeft)} ครั้งใน 10 นาที
        </span>
      </div>

      <h2 style={{ fontFamily: 'var(--display)', fontSize: '1.3rem', margin: 0 }}>{puzzle.title}</h2>

      {puzzle.prompt && (
        <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>{puzzle.prompt}</p>
      )}

      {imageUrl && puzzle.media_url && <PuzzleImage key={puzzle.media_url} url={imageUrl} title={puzzle.title} />}
      {!imageUrl && puzzle.media_url && (
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--ember)' }}>โหลดรูปโจทย์ไม่สำเร็จ ลองรีเฟรชหน้า</p>
      )}

      {puzzle.hint && (
        <div className="puzzle-hint">
          <span className="puzzle-hint-label">คำใบ้</span>
          <p>{puzzle.hint}</p>
        </div>
      )}

      <form action={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <label htmlFor="answer" className="label">คำตอบของคุณ</label>
        <input
          id="answer" name="answer" required maxLength={500} autoComplete="off"
          className="field" placeholder="พิมพ์คำตอบ" style={{ fontFamily: 'var(--tech)' }}
        />
        <button type="submit" className="btn-brass" disabled={pending || !campOpen}>
          {pending ? 'กำลังส่ง…' : 'ส่งคำตอบ'}
        </button>
      </form>

      {shown && (
        <p role="alert" style={{
          display: 'flex', alignItems: 'flex-start', gap: 9, margin: 0,
          padding: '0.7rem 0.85rem', borderRadius: 3,
          background: 'color-mix(in oklab, var(--ember) 12%, transparent)',
          border: '1px solid color-mix(in oklab, var(--ember) 45%, transparent)',
          fontSize: '0.86rem',
        }}>
          <TriangleAlert size={16} color="var(--ember)" aria-hidden="true" style={{ flexShrink: 0 }} />
          {MESSAGES[shown.status] ?? 'ลองใหม่อีกครั้ง'}
        </p>
      )}

      {/* ถูกย้ายมานั่งที่นั่งใหม่ = มีโจทย์ใหม่ให้ทำ แต่รหัสเดิมที่ได้มายังใช้ได้อยู่ */}
      <EarnedCode code={puzzle.earned_code} />
    </div>
  )
}
