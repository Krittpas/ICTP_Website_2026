'use client'

import { useActionState, useState } from 'react'
import { Eye, EyeOff, TriangleAlert } from 'lucide-react'
import { loginAction, type LoginState } from '@/actions/auth'

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, null)
  const [show, setShow] = useState(false)

  return (
    <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 440 }}>
      <div>
        <label htmlFor="email" className="label">อีเมล</label>
        <input
          id="email" name="email" type="email" required autoComplete="email"
          placeholder="s12345@bj.ac.th" className="field"
          style={{ fontFamily: 'var(--tech)' }}
        />
        <p style={{ margin: '0.4rem 0 0', fontSize: '0.78rem', color: 'var(--muted)' }}>
          รูปแบบที่ระบบรับคือ <span style={{ fontFamily: 'var(--tech)', color: 'var(--text)' }}>sXXXXX@bj.ac.th</span>
        </p>
      </div>

      <div>
        <label htmlFor="password" className="label">รหัสผ่าน</label>
        <div style={{ position: 'relative' }}>
          <input
            id="password" name="password" required autoComplete="current-password"
            type={show ? 'text' : 'password'} className="field"
            style={{ fontFamily: 'var(--tech)', paddingRight: '3rem' }}
          />
          <button
            type="button"
            onClick={() => setShow(v => !v)}
            aria-label={show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
            style={{
              position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
              width: 44, height: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer',
            }}
          >
            {show ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
      </div>

      {state?.error && (
        <p role="alert" style={{
          display: 'flex', alignItems: 'flex-start', gap: 9, margin: 0,
          padding: '0.75rem 0.9rem', borderRadius: 3,
          background: 'color-mix(in oklab, var(--ember) 12%, transparent)',
          border: '1px solid color-mix(in oklab, var(--ember) 45%, transparent)',
          fontSize: '0.86rem', color: 'var(--text)',
        }}>
          <TriangleAlert size={17} color="var(--ember)" aria-hidden="true" style={{ flexShrink: 0 }} />
          {state.error}
        </p>
      )}

      <button type="submit" className="btn-brass" disabled={pending} style={{ width: '100%' }}>
        {pending ? 'กำลังผลักประตู…' : 'ผลักประตูเข้าไป →'}
      </button>
    </form>
  )
}
