'use client'

import { useEffect, useRef, useState } from 'react'

export interface AdminSection {
  id: string
  label: string
  /** คำอธิบายสั้น ๆ ใต้ชื่อแท็บที่กำลังเปิด */
  blurb: string
  /** ตัวเลขสีแดงบนแท็บ เช่นจำนวนข้อที่ต้องแก้ก่อนเปิดระบบ */
  alert?: number
  content: React.ReactNode
}

const STORE_KEY = 'ictp-admin-tab'

/**
 * แบ่งหน้าพี่ค่ายเป็นหมวด
 *
 * ทุกหมวดถูก render ไว้ตั้งแต่แรกแล้วซ่อนด้วย hidden ไม่ใช่ถอดออกจากหน้า
 * เพราะฟอร์มในหมวดอื่นกรอกค้างไว้ได้ — สลับแท็บไปดูอย่างอื่นแล้วกลับมาต้องไม่หาย
 * (ข้อมูลทุกอย่างถูกดึงมาพร้อมกันตอนโหลดหน้าอยู่แล้ว การซ่อนจึงไม่ได้ปิดบังอะไรเพิ่ม)
 *
 * แท็บที่เปิดค้างไว้ถูกจำไว้ในเครื่อง — พี่ค่ายรีเฟรชหน้ากลางงานแล้วได้หมวดเดิม
 */
export function AdminTabs({ sections }: { sections: AdminSection[] }) {
  const [active, setActive] = useState(sections[0]?.id ?? '')
  const tabs = useRef<(HTMLButtonElement | null)[]>([])

  // prop sections เป็นอาร์เรย์ใหม่ทุกครั้งที่ server render ซ้ำ (เช่นหลังบันทึกฟอร์ม)
  // ผูก effect ไว้กับรายชื่อ id แทน จะได้ทำงานครั้งเดียวจริง ๆ ไม่ใช่ทุกรอบ
  const ids = sections.map(s => s.id).join(',')

  // อ่านหลัง mount เท่านั้น ไม่อย่างนั้น HTML จาก server จะไม่ตรงกับ client
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORE_KEY)
      if (saved && ids.split(',').includes(saved)) setActive(saved)
    } catch {
      // เบราว์เซอร์ปิด storage ไว้ = ใช้แท็บแรกตามเดิม ไม่ใช่เรื่องคอขาดบาดตาย
    }
  }, [ids])

  function go(id: string) {
    setActive(id)
    try { localStorage.setItem(STORE_KEY, id) } catch { /* ไม่ต้องจำก็ได้ */ }
  }

  // ลูกศรซ้าย/ขวาเลื่อนแท็บตามมาตรฐาน tablist
  function onKey(e: React.KeyboardEvent, index: number) {
    const last = sections.length - 1
    const next = e.key === 'ArrowRight' ? (index === last ? 0 : index + 1)
      : e.key === 'ArrowLeft' ? (index === 0 ? last : index - 1)
      : e.key === 'Home' ? 0
      : e.key === 'End' ? last
      : -1
    if (next < 0) return
    e.preventDefault()
    go(sections[next].id)
    tabs.current[next]?.focus()
  }

  const current = sections.find(s => s.id === active) ?? sections[0]

  return (
    <div className="admin-tabs">
      <div className="admin-tablist" role="tablist" aria-label="หมวดของแผงควบคุมพี่ค่าย">
        {sections.map((section, i) => (
          <button
            key={section.id}
            ref={el => { tabs.current[i] = el }}
            type="button"
            role="tab"
            id={`admin-tab-${section.id}`}
            aria-selected={section.id === active}
            aria-controls={`admin-panel-${section.id}`}
            tabIndex={section.id === active ? 0 : -1}
            className="admin-tab"
            onClick={() => go(section.id)}
            onKeyDown={e => onKey(e, i)}
          >
            {section.label}
            {section.alert ? (
              <span className="admin-tab-alert" aria-label={`ต้องแก้ ${section.alert} ข้อ`}>{section.alert}</span>
            ) : null}
          </button>
        ))}
      </div>

      {current && <p className="admin-tab-blurb">{current.blurb}</p>}

      {sections.map(section => (
        <div
          key={section.id}
          id={`admin-panel-${section.id}`}
          role="tabpanel"
          aria-labelledby={`admin-tab-${section.id}`}
          tabIndex={0}
          hidden={section.id !== active}
          className="admin-panel"
        >
          {section.content}
        </div>
      ))}
    </div>
  )
}
