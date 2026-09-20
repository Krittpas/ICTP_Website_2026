'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // ธีมจริงรู้ได้หลัง hydrate เท่านั้น — ทั้งไอคอนและ aria-label ต้องรอ mounted
  // ไม่อย่างนั้น HTML จาก server (ไม่รู้ธีม) จะไม่ตรงกับ client
  useEffect(() => setMounted(true), [])

  const dark = mounted && resolvedTheme === 'dark'
  const label = !mounted ? 'สลับโทนสี' : dark ? 'สลับเป็นโทนสว่าง' : 'สลับเป็นโทนมืด'

  return (
    <button
      type="button"
      className="icon-btn"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      aria-label={label}
      title={label}
    >
      {mounted ? (dark ? <Sun size={17} /> : <Moon size={17} />) : <span style={{ width: 17, height: 17 }} />}
    </button>
  )
}
