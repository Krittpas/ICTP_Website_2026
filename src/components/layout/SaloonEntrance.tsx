'use client'

import { createPortal } from 'react-dom'

/**
 * ฉากผลักประตูซาลูน — ขึ้นคลุมทั้งจอตอนกด "ผลักประตูเข้าไป"
 *
 * ประตูบานคู่เปิดออกสองข้าง แล้วมาสคอตวัวควบม้าวนผ่านหน้าจอไปเรื่อย ๆ จนกว่าจะเข้าระบบได้
 * ทุกอย่างวาดด้วย CSS ยกเว้นตัวมาสคอต จึงไม่ต้องรอโหลดอะไรก่อนเริ่มเล่น
 *
 * ต้องแขวนไว้ที่ <body> ผ่าน portal ไม่ใช่ปล่อยไว้ในฟอร์ม
 * เพราะ .login-card มี backdrop-filter ซึ่งทำให้ตัวเองกลายเป็นกรอบอ้างอิงของ position: fixed
 * ฉากจะถูกขังอยู่ในกรอบการ์ดแทนที่จะเต็มจอ
 *
 * ฉากนี้เป็นการตกแต่งล้วน ๆ — ซ่อนจาก screen reader ทั้งก้อน
 * แล้วบอกสถานะด้วยข้อความ aria-live สั้น ๆ แทน (ดู LoginForm)
 */
export function SaloonEntrance() {
  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="saloon" aria-hidden="true">
      <div className="saloon-room" />

      <div className="saloon-door saloon-door--left">
        <span className="saloon-slat" /><span className="saloon-slat" /><span className="saloon-slat" />
        <span className="saloon-knob" />
      </div>
      <div className="saloon-door saloon-door--right">
        <span className="saloon-slat" /><span className="saloon-slat" /><span className="saloon-slat" />
        <span className="saloon-knob" />
      </div>

      <div className="saloon-rider">
        {/* eslint-disable-next-line @next/next/no-img-element -- ภาพตกแต่งขนาดเดียว ไม่ต้องผ่านตัวย่อรูป */}
        <img src="/mascot-rider.webp" alt="" width={512} height={512} />
      </div>

      <div className="saloon-dust" />
      <p className="saloon-caption">กำลังผลักประตูซาลูนเข้าไป…</p>
    </div>,
    document.body,
  )
}
