'use client'

import { useState, useTransition } from 'react'
import { TriangleAlert, Unlock } from 'lucide-react'
import { revealSeniorAction } from '@/actions/decrypt'
import { SECRET_CODE_LENGTH } from '@/lib/puzzles/secret-code'
import type { SeniorReveal } from '@/types/app'

const MESSAGES: Record<string, string> = {
  not_solved:   'คุณยังไม่มีรหัสลับประจำตัว ไขปริศนาของตัวเองให้ผ่านก่อน หรือติดต่อพี่ค่าย',
  no_match:     'รหัสถูกต้อง แต่พี่ค่ายยังไม่ได้บันทึกพี่รหัสของคุณ ติดต่อพี่ค่ายได้เลย',
  unassigned:   'คุณยังไม่ถูกส่งไปประจำเมืองไหน ติดต่อพี่ค่าย',
  rate_limited: 'ใส่รหัสผิดครบ 5 ครั้งแล้ว เครื่องร้อนเกินไป พัก 10 นาทีก่อนลองใหม่',
  locked:       'ประตูสำนักงานนายอำเภอถูกปิดกลับแล้ว',
  unauthorized: 'กรุณาเข้าสู่ระบบใหม่',
  error:        'เครื่องขัดข้อง ลองใหม่อีกครั้ง',
}

function errorText(r: SeniorReveal) {
  if (r.status === 'incorrect') {
    return r.attempts_left >= 0
      ? `รหัสนี้ไม่ใช่ของคุณ เหลืออีก ${Math.max(0, r.attempts_left)} ครั้งใน 10 นาที`
      : 'รหัสนี้ไม่ใช่ของคุณ ลองใหม่อีกครั้ง'
  }
  return MESSAGES[r.status] ?? 'ลองใหม่อีกครั้ง'
}

/** เครื่องถอดรหัสประจำสำนักงานนายอำเภอ — ใส่รหัสลับของตัวเอง เผยตัวตนพี่รหัสของตัวเอง */
export function DecryptTerminal({ initial }: { initial: SeniorReveal }) {
  const [state, setState] = useState<SeniorReveal>(initial)
  const [pending, start] = useTransition()

  function onSubmit(formData: FormData) {
    const code = String(formData.get('code') ?? '')
    start(async () => setState(await revealSeniorAction(code)))
  }

  if (state.status === 'revealed') return <RevealCard {...state} />

  const failed = state.status !== 'ready'

  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <div className="panel scanlines" style={{
        position: 'relative', maxWidth: 640, width: '100%',
        padding: '2rem 1.75rem', borderColor: 'var(--neon)',
      }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1rem' }}>
            <Unlock size={20} color="var(--neon)" aria-hidden="true" />
            <span className="stamp" style={{ fontSize: '0.74rem', color: 'var(--neon)' }}>
              DECRYPT TERMINAL · สำนักงานนายอำเภอกลาง
            </span>
          </div>

          <h1 style={{ fontFamily: 'var(--display)', fontSize: '1.7rem', color: 'var(--brass-lit)', margin: '0 0 1rem' }}>
            เครื่องถอดรหัสลับ
          </h1>

          <p style={{
            margin: '0 0 1.5rem', padding: '1rem',
            background: 'var(--plank-2)', borderLeft: '3px solid var(--neon)',
            fontSize: '0.95rem', lineHeight: 1.85,
          }}>
            ประตูเปิดแล้ว ชาวเมืองทั้งหลาย<br />
            นำ <strong style={{ color: 'var(--brass-lit)' }}>รหัสลับประจำตัว</strong> ที่ได้จากปริศนาของคุณมาใส่เครื่อง
            เพื่อปลดล็อคเบาะแสและเผยตัวตนของพี่รหัส
          </p>

          <form action={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label htmlFor="code" className="label">รหัสลับประจำตัว ({SECRET_CODE_LENGTH} อักขระ)</label>
            <input
              id="code" name="code" required maxLength={200} autoComplete="off"
              spellCheck={false} autoCapitalize="none" autoCorrect="off"
              className="field" placeholder={'เช่น Kq7#mZ2$bR9!vT4&xW'}
              style={{ fontFamily: 'var(--tech)', fontSize: '1.05rem', letterSpacing: '0.06em' }}
            />
            <button type="submit" className="btn-brass" disabled={pending}>
              {pending ? 'เครื่องกำลังถอดรหัส…' : 'ถอดรหัส'}
            </button>
          </form>

          <p style={{ margin: '0.9rem 0 0', fontSize: '0.8rem', color: 'var(--muted)', lineHeight: 1.7 }}>
            ลืมรหัสของตัวเอง? ดูซ้ำได้ที่แท็บ “ปริศนา & ภาพรวม”
          </p>

          {failed && (
            <p role="alert" style={{
              display: 'flex', alignItems: 'flex-start', gap: 9, margin: '1rem 0 0',
              padding: '0.7rem 0.85rem', borderRadius: 3,
              background: 'color-mix(in oklab, var(--ember) 12%, transparent)',
              border: '1px solid color-mix(in oklab, var(--ember) 45%, transparent)',
              fontSize: '0.86rem',
            }}>
              <TriangleAlert size={16} color="var(--ember)" aria-hidden="true" style={{ flexShrink: 0, marginTop: 3 }} />
              {errorText(state)}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

/** ผลการถอดรหัส — กระดาษเก่าชุดเดียวกับบันทึกลับ ปิดท้ายด้วยตราครั่ง */
function RevealCard({ senior_name, senior_nickname, clue }: { senior_name: string; senior_nickname: string; clue: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '1rem' }}>
      <article className="reveal" aria-labelledby="reveal-name">
        <span className="story-kicker">✦ เครื่องถอดรหัสเผยนามผู้พิทักษ์ของคุณ ✦</span>
        <p className="reveal-lead">พี่รหัสของคุณคือ</p>
        <h1 id="reveal-name" className="reveal-name">{senior_name}</h1>
        {senior_nickname && <p className="reveal-nick">“พี่{senior_nickname.replace(/^พี่\s*/, '')}”</p>}

        {clue && (
          <div className="reveal-clue">
            <span className="reveal-clue-label">เบาะแส</span>
            <p>{clue}</p>
          </div>
        )}

        <span className="story-seal reveal-seal" aria-hidden="true"><span>ICTP</span></span>
      </article>
    </div>
  )
}
