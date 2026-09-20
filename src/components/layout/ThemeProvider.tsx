'use client'

import { ThemeProvider as NextThemes } from 'next-themes'

/**
 * ค่าเริ่มต้นเป็นโทนมืด เพราะเป็นหน้าตาหลักของแบรนด์
 * แต่เคารพค่าที่เครื่องผู้ใช้ตั้งไว้ผ่านตัวเลือก system
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemes attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      {children}
    </NextThemes>
  )
}
