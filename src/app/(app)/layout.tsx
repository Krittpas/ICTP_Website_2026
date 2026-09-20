import { requireUser } from '@/lib/auth/dal'
import { getCampState } from '@/lib/camp/state'
import { AppNav } from '@/components/layout/AppNav'
import { LiveRefresh } from '@/components/layout/LiveRefresh'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // requireUser() ใช้ getUser() และเด้งไป /login เองถ้าไม่ได้ล็อกอิน
  const [user, camp] = await Promise.all([requireUser(), getCampState()])

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <AppNav user={user} decryptUnlocked={camp.decrypt_unlocked} />
      <main style={{ flexGrow: 1, width: '100%', maxWidth: 1240, margin: '0 auto', padding: '1.5rem 1rem 4rem' }}>
        {children}
      </main>
      <LiveRefresh />
    </div>
  )
}
