import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { LoginForm } from '@/components/layout/LoginForm'
import { ThemeToggle } from '@/components/layout/ThemeToggle'

export const metadata = { title: 'เข้าสู่ระบบ' }

export default function LoginPage() {
  return (
    <main className="login-page">
      <Image src="/hero-banner.webp" alt="" fill preload sizes="100vw" className="login-bg" />
      <div className="login-shade" aria-hidden="true" />

      <div className="login-topbar">
        <Link href="/" className="login-back">
          <ArrowLeft size={16} aria-hidden="true" /> กลับหน้าแรก
        </Link>
        <ThemeToggle />
      </div>

      <section className="login-card" aria-labelledby="login-title">
        <Image
          src="/logo-ictp.webp" alt="ICTP Family 2026"
          width={766} height={580} preload className="login-logo"
        />

        <div style={{ textAlign: 'center' }}>
          <span className="stamp" style={{ color: 'var(--brass)' }}>★ CYBERING SALOON ★</span>
          <h1 id="login-title" className="login-title">เข้าสู่ระบบ</h1>
          <p className="login-sub">ใช้อีเมลโรงเรียนและรหัสผ่านที่ได้รับ</p>
        </div>

        <LoginForm />
      </section>
    </main>
  )
}
