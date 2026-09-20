'use client'

import { useState, useTransition } from 'react'
import { Copy, Check } from 'lucide-react'
import { createStudentAction } from '@/actions/admin'
import { NAME_RULE } from '@/lib/profile/names'

/**
 * สร้างบัญชีน้องค่าย
 *
 * รหัสผ่านถูกส่งกลับมาครั้งเดียวและไม่ถูกเก็บที่ไหนเลย
 * ปิดหน้าหรือสร้างคนถัดไปแล้วจะดูย้อนไม่ได้ ต้องจดทันที
 */
export function StudentCreator() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [nickname, setNickname] = useState('')
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [pending, start] = useTransition()

  function submit() {
    setError(null)
    setCopied(false)
    start(async () => {
      const res = await createStudentAction(email, name, nickname)
      if (res.error || !res.password) {
        setError(res.error ?? 'สร้างบัญชีไม่สำเร็จ')
        return
      }
      setCreated({ email: email.trim().toLowerCase(), password: res.password })
      setEmail('')
      setName('')
      setNickname('')
    })
  }

  async function copy() {
    if (!created) return
    try {
      await navigator.clipboard.writeText(`${created.email}\t${created.password}`)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section className="panel" style={{ padding: '1.4rem', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <span className="stamp" style={{ fontSize: '0.72rem', color: 'var(--neon)' }}>สร้างบัญชีน้องค่าย</span>

      <div>
        <label htmlFor="sc-email" className="label">อีเมลนักเรียน</label>
        <input id="sc-email" className="field" type="email" autoComplete="off" value={email}
               onChange={e => setEmail(e.target.value)} placeholder="s12345@bj.ac.th"
               style={{ fontFamily: 'var(--tech)' }} />
      </div>

      <div>
        <label htmlFor="sc-name" className="label">ชื่อ-นามสกุล (ภาษาไทย)</label>
        <input id="sc-name" className="field" maxLength={100} value={name}
               onChange={e => setName(e.target.value)} placeholder="เช่น สมชาย ใจดี" />
      </div>

      <div>
        <label htmlFor="sc-nick" className="label">ชื่อเล่น (ภาษาไทย)</label>
        <input id="sc-nick" className="field" maxLength={30} value={nickname}
               onChange={e => setNickname(e.target.value)} placeholder="เช่น เอก" />
      </div>

      <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--muted)', lineHeight: 1.6 }}>{NAME_RULE}</p>

      <button type="button" className="btn-ghost" disabled={pending || !email || !name.trim() || !nickname.trim()} onClick={submit}>
        {pending ? 'กำลังสร้าง…' : 'สร้างบัญชี'}
      </button>

      {error && <p role="alert" style={{ margin: 0, fontSize: '0.86rem', color: 'var(--ember)' }}>{error}</p>}

      {created && (
        <div role="status" style={{
          padding: '0.9rem 1rem', borderRadius: 3,
          background: 'var(--plank-2)', border: '1px solid var(--neon)',
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
            สร้างแล้ว — รหัสผ่านแสดงครั้งเดียว จดไว้ก่อนสร้างคนถัดไป
          </span>
          <span style={{ fontFamily: 'var(--tech)', fontSize: '0.9rem' }}>{created.email}</span>
          <span style={{ fontFamily: 'var(--tech)', fontSize: '1.3rem', letterSpacing: '0.08em', color: 'var(--neon)' }}>
            {created.password}
          </span>
          <button type="button" className="btn-ghost" onClick={copy}
                  style={{ alignSelf: 'flex-start', padding: '0.4rem 0.8rem', minHeight: 36 }}>
            {copied ? <><Check size={13} aria-hidden="true" /> คัดลอกแล้ว</> : <><Copy size={13} aria-hidden="true" /> คัดลอก</>}
          </button>
        </div>
      )}

      <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--muted)', lineHeight: 1.6 }}>
        ต้องตั้ง <span style={{ fontFamily: 'var(--tech)' }}>SUPABASE_SERVICE_ROLE_KEY</span> ไว้ฝั่ง server ก่อน
        สร้างเสร็จแล้วกดสุ่มจัดเมืองอีกครั้งเพื่อให้น้องใหม่ได้ที่นั่ง
      </p>
    </section>
  )
}
