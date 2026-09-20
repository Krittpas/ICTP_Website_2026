'use client'

import { Fragment, useEffect, useRef } from 'react'
import { ScrollText, X } from 'lucide-react'
import { VALLEY_STORY as S } from '@/content/valley-story'

const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI']

/** แปลง **คำ** เป็นตัวหนาหมึกแดง — พอสำหรับเนื้อเรื่อง ไม่ต้องพึ่งตัวแปลง markdown */
function Inked({ text }: { text: string }) {
  return text.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : <Fragment key={i}>{part}</Fragment>,
  )
}

/**
 * บันทึกลับแห่งหุบเขา ICTP
 *
 * เด้งขึ้นเองทุกครั้งที่เข้าส่วน "ตามหาพี่รหัส" (อยู่ใน layout จึงไม่เด้งซ้ำตอนสลับแท็บย่อย)
 * ปิดแล้วเปิดอ่านใหม่ได้จากปุ่มข้างหัวข้อ
 * ใช้ <dialog> ของเบราว์เซอร์ — ได้ Esc ปิด · กักโฟกัส · ประกาศให้ screen reader ฟรี
 */
export function ValleyStory() {
  const ref = useRef<HTMLDialogElement>(null)

  const open = () => { if (!ref.current?.open) ref.current?.showModal() }
  const close = () => ref.current?.close()

  useEffect(open, [])

  return (
    <>
      <button type="button" className="btn-ghost story-trigger" aria-haspopup="dialog" onClick={open}>
        <ScrollText size={16} aria-hidden="true" /> บันทึกลับ
      </button>

      <dialog
        ref={ref}
        className="story"
        aria-labelledby="story-title"
        // คลิกนอกกระดาษ (ที่ backdrop) = ปิด — ตัว dialog ไม่มี padding เป้าหมายจึงเป็น dialog เฉพาะตอนคลิกนอก
        onClick={e => { if (e.target === e.currentTarget) close() }}
      >
        <button type="button" className="story-close" aria-label="ปิดบันทึกลับ" onClick={close}>
          <X size={18} aria-hidden="true" />
        </button>

        {/* โฟกัสแรกอยู่ที่กระดาษ ไม่ใช่ปุ่มปิด — ไม่ขึ้นกรอบโฟกัสทันทีที่เปิด และใช้ลูกศร/Space เลื่อนอ่านได้ */}
        <article className="story-paper" tabIndex={-1} autoFocus>
          <header className="story-head">
            <span className="story-kicker">✦ บันทึกลับจากสำนักงานนายอำเภอ ✦</span>
            <h2 id="story-title" className="story-title">{S.title}</h2>
            <p className="story-subtitle">{S.subtitle}</p>
            <div className="story-rule" aria-hidden="true"><span>✦</span></div>
          </header>

          {S.intro.map(p => <p key={p} className="story-p"><Inked text={p} /></p>)}

          <figure className="story-stone">
            <figcaption>ศิลาจารึกหน้าสำนักงานนายอำเภอ</figcaption>
            <blockquote>“{S.inscription}”</blockquote>
          </figure>

          <p className="story-p"><Inked text={S.warning} /></p>

          <h3 className="story-h3">{S.rulesTitle}</h3>

          {S.rules.map((chapter, i) => (
            <section key={chapter.title} className="story-chapter">
              <h4><span className="story-numeral" aria-hidden="true">{NUMERALS[i]}</span>{chapter.title}</h4>
              <ul>
                {chapter.items.map(item => <li key={item}><Inked text={item} /></li>)}
              </ul>
            </section>
          ))}

          <footer className="story-foot">
            <span className="story-seal" aria-hidden="true"><span>ICTP</span></span>
            <button type="button" className="story-go" onClick={close}>รับทราบ ออกเดินทาง →</button>
          </footer>
        </article>
      </dialog>
    </>
  )
}
