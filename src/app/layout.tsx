import type { Metadata, Viewport } from 'next'
import { Athiti, Rye, Share_Tech_Mono } from 'next/font/google'
import { ThemeProvider } from '@/components/layout/ThemeProvider'
import { ConfirmProvider } from '@/components/layout/ConfirmDialog'
import { Toaster } from 'sonner'
import './globals.css'

/** ฟอนต์หลักทั้งเว็บ — ทั้งหัวข้อ (700) และเนื้อความ (400–600) */
const athiti = Athiti({
  weight: ['300', '400', '500', '600', '700'], subsets: ['latin', 'thai'], variable: '--font-athiti', display: 'swap',
})
/*
 * Share Tech Mono ใช้กับรหัสลับและป้ายตัวเล็ก ไม่มีตัวอักษรไทย
 * จึงต้องมี Athiti ต่อท้ายในสแตก (ดู --tech ใน globals.css) และปิด adjustFontFallback
 * ไม่อย่างนั้น Next จะแทรก Courier ที่ปรับขนาดไว้หน้าฟอนต์ไทย
 */
const tech = Share_Tech_Mono({
  weight: '400', subsets: ['latin'], variable: '--font-tech', display: 'swap', adjustFontFallback: false,
})
/** ตัวอักษรใบประกาศจับตะวันตก — ใช้แค่หัวเรื่องภาษาอังกฤษของบันทึกลับ ไม่มีตัวไทย */
const western = Rye({
  weight: '400', subsets: ['latin'], variable: '--font-western', display: 'swap', adjustFontFallback: false,
})

export const metadata: Metadata = {
  title: {
    default: 'ICTP Camp 2026 — Cybering Saloon',
    template: '%s — ICTP Camp 2026',
  },
  description: 'ค่ายสายการเรียน ICTP ปี 2026 — ชายแดนเก่า เครือข่ายใหม่ และรหัสลับที่รอให้ไข',
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F4EBD9' },
    { media: '(prefers-color-scheme: dark)',  color: '#140F0A' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" suppressHydrationWarning className={`${athiti.variable} ${tech.variable} ${western.variable}`}>
      <body>
        <ThemeProvider>
          <ConfirmProvider>{children}</ConfirmProvider>
          <Toaster position="top-center" richColors />
        </ThemeProvider>
      </body>
    </html>
  )
}
