'use client'

import { ThemeProvider as NextThemes } from 'next-themes'

/**
 * ค่าเริ่มต้นเป็นโทนมืด เพราะเป็นหน้าตาหลักของแบรนด์
 * แต่เคารพค่าที่เครื่องผู้ใช้ตั้งไว้ผ่านตัวเลือก system
 *
 * nonce มาจาก middleware ผ่าน root layout — next-themes ฝังสคริปต์เล็ก ๆ ไว้ในหน้า
 * เพื่ออ่านธีมที่เลือกไว้ก่อนวาดจอ ถ้าไม่มี nonce สคริปต์นั้นจะโดน CSP บล็อก
 */
export function ThemeProvider({ children, nonce }: { children: React.ReactNode; nonce?: string }) {
  return (
    <NextThemes attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange nonce={nonce}>
      {children}
    </NextThemes>
  )
}
