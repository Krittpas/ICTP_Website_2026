'use client'

import { useState, useTransition } from 'react'
import { Check, Lock, Maximize2, TriangleAlert } from 'lucide-react'
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

export function MyPuzzlePanel({ puzzle, campOpen, imageUrl }: { puzzle: MyPuzzle; campOpen: boolean; imageUrl?: string | null }) {
  const [result, setResult] = useState<AnswerResult | null>(null)
  const [pending, start] = useTransition()

  if (puzzle.status === 'unassigned' || puzzle.status === 'no_puzzle' || puzzle.status === 'unauthorized') {
    return (
      <p style={{ margin: 0, color: 'var(--muted)', fontSize: '0.9rem', lineHeight: 1.8 }}>
        ยังไม่มีปริศนาสำหรับคุณ รอพี่ค่ายจัดเมืองและใส่โจทย์ก่อนนะ
      </p>
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
          คุณคือคาวบอย #{puzzle.seat_index}<br />
          โจทย์จะโผล่ขึ้นมาเองเมื่อพี่ค่ายเปิดระบบและถึงตาคุณ
        </p>
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
          คำสาปโซ่ตรวนคลายมาถึงคาวบอย #{puzzle.current_seat}<br />
          คุณคือคาวบอย #{puzzle.seat_index}
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

        <div style={{
          padding: '1.2rem 1rem', borderRadius: 3,
          background: 'var(--plank-2)', border: '1px solid var(--neon)',
        }}>
          <div className="stamp" style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 8 }}>
            รหัสลับของคุณ
          </div>
          <div style={{ fontFamily: 'var(--tech)', fontSize: '1.7rem', letterSpacing: '0.12em', color: 'var(--neon)', wordBreak: 'break-all' }}>
            {puzzle.secret_code}
          </div>
          <p style={{ margin: '0.8rem 0 0', fontSize: '0.76rem', color: 'var(--muted)', lineHeight: 1.6 }}>
            จดไว้ให้ดี ใช้กับเครื่องถอดรหัสที่สำนักงานนายอำเภอ<br />เปิดดูซ้ำได้ตลอดจากหน้านี้
          </p>
        </div>
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
        <div style={{ padding: '1.2rem 1rem', borderRadius: 3, background: 'var(--plank-2)', border: '1px solid var(--neon)' }}>
          <div className="stamp" style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 8 }}>รหัสลับของคุณ</div>
          <div style={{ fontFamily: 'var(--tech)', fontSize: '1.7rem', letterSpacing: '0.12em', color: 'var(--neon)', wordBreak: 'break-all' }}>
            {shown.secret_code}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <span className="stamp" style={{ fontSize: '0.72rem', color: 'var(--brass-lit)' }}>
          คาวบอย #{puzzle.seat_index} · ถึงตาคุณ
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
    </div>
  )
}
