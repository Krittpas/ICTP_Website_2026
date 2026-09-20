import { SeniorTabs } from '@/components/layout/SeniorTabs'
import { ValleyStory } from '@/components/senior/ValleyStory'

export default function SeniorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', margin: '0 0 0.75rem' }}>
          <h1 style={{ fontFamily: 'var(--display)', fontSize: '2rem', color: 'var(--brass-lit)', margin: 0 }}>
            ตามหาพี่รหัส
          </h1>
          <ValleyStory />
        </div>
        <SeniorTabs />
      </div>
      {children}
    </div>
  )
}
