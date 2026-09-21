import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Next.js 16 เปลี่ยนชื่อ middleware เป็น proxy และ middleware ถือว่า deprecated แล้ว
 * แต่ Vercel ยังเคย deploy proxy.ts ไม่ผ่านในโปรเจกต์นี้ จึงคงชื่อเดิมไว้ก่อน
 * เมื่อ Vercel รองรับแล้ว เปลี่ยนได้ด้วยการเปลี่ยนชื่อไฟล์เป็น proxy.ts
 * และเปลี่ยนชื่อฟังก์ชันเป็น proxy เท่านั้น
 *
 * ที่นี่ทำสามอย่าง: ออก CSP ประจำคำขอ · รีเฟรช token · กันเส้นทางแบบหยาบ ๆ
 * การตัดสินสิทธิ์จริงอยู่ใน layout (getUser) และ RPC ฝั่งฐานข้อมูล
 */

/** โดเมน Supabase ของโปรเจกต์ — ต้องเปิดให้เบราว์เซอร์ต่อได้ ไม่อย่างนั้น CSP บล็อกทั้งเว็บ */
function supabaseOrigins() {
  try {
    const { origin, host } = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!)
    return { http: origin, ws: `wss://${host}` }
  } catch {
    return { http: '', ws: '' }
  }
}

/**
 * CSP แบบ nonce
 *
 * สคริปต์ที่ไม่มี nonce ของคำขอนี้จะไม่ถูกรัน — สคริปต์ที่แอบฝังผ่านช่องกรอกจึงตายตั้งแต่ต้น
 * 'strict-dynamic' ให้สคริปต์ที่ Next โหลดต่อเองทำงานได้โดยไม่ต้องไล่ allowlist ทีละไฟล์
 * ('unsafe-inline' กับ https: ในบรรทัดเดียวกันถูกเบราว์เซอร์สมัยใหม่มองข้ามเมื่อมี nonce
 *  ใส่ไว้เป็นทางถอยให้เบราว์เซอร์เก่าเท่านั้น)
 *
 * style-src ต้องมี 'unsafe-inline' เพราะทั้งเว็บเขียนสไตล์เป็น attribute บน element
 * ซึ่ง nonce ใช้ด้วยไม่ได้ตามสเปก — ความเสี่ยงของการยัดสไตล์ต่ำกว่าการยัดสคริปต์มาก
 */
function contentSecurityPolicy(nonce: string) {
  const supabase = supabaseOrigins()
  const dev = process.env.NODE_ENV !== 'production'

  return [
    "default-src 'self'",
    // dev ต้องการ 'unsafe-eval' ให้ hot reload ทำงาน — ของจริงไม่มี
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline' https:${dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${supabase.http}`,
    "font-src 'self' data:",
    `connect-src 'self' ${supabase.http} ${supabase.ws}${dev ? ' ws: http:' : ''}`,
    `media-src 'self' blob: ${supabase.http}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    // ไม่มีอะไรในเว็บนี้ต้องใช้ปลั๊กอินหรือ iframe
    "object-src 'none'",
    "frame-src 'none'",
    // ห้ามใครเอาเว็บนี้ไปแปะใน iframe
    "frame-ancestors 'none'",
    // ห้ามเปลี่ยนฐานของ URL สัมพัทธ์ กันสคริปต์ถูกเปลี่ยนทางไปโหลดจากที่อื่น
    "base-uri 'none'",
    // ฟอร์มส่งออกนอกเว็บไม่ได้ กันหน้าล็อกอินปลอมส่งรหัสผ่านออกไป
    "form-action 'self'",
    'upgrade-insecure-requests',
  ].join('; ')
}

export async function middleware(request: NextRequest) {
  // nonce ใหม่ทุกคำขอ เดาล่วงหน้าไม่ได้
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const csp = contentSecurityPolicy(nonce)

  // Next อ่าน CSP จาก header ของ "คำขอ" เพื่อเอา nonce ไปติดให้สคริปต์ของตัวเอง
  // ส่วน layout อ่าน x-nonce ไปส่งต่อให้คอมโพเนนต์ที่ฝังสคริปต์เอง (next-themes)
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('Content-Security-Policy', csp)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => list.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)),
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  const guarded = ['/camp', '/senior', '/decrypt', '/admin']
  if (guarded.some(p => pathname.startsWith(p)) && !user) {
    const redirect = NextResponse.redirect(new URL('/login', request.url))
    redirect.headers.set('Content-Security-Policy', csp)
    return redirect
  }
  if (pathname === '/login' && user) {
    const redirect = NextResponse.redirect(new URL('/camp', request.url))
    redirect.headers.set('Content-Security-Policy', csp)
    return redirect
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
