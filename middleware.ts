import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Next.js 16 เปลี่ยนชื่อ middleware เป็น proxy และ middleware ถือว่า deprecated แล้ว
 * แต่ Vercel ยังเคย deploy proxy.ts ไม่ผ่านในโปรเจกต์นี้ จึงคงชื่อเดิมไว้ก่อน
 * เมื่อ Vercel รองรับแล้ว เปลี่ยนได้ด้วยการเปลี่ยนชื่อไฟล์เป็น proxy.ts
 * และเปลี่ยนชื่อฟังก์ชันเป็น proxy เท่านั้น
 *
 * ที่นี่ทำแค่สองอย่าง: รีเฟรช token และกันเส้นทางแบบหยาบ ๆ
 * การตัดสินสิทธิ์จริงอยู่ใน layout (getUser) และ RPC ฝั่งฐานข้อมูล
 */
export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request: { headers: request.headers } })

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
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (pathname === '/login' && user) {
    return NextResponse.redirect(new URL('/camp', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
