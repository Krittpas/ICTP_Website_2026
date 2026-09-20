'use client'

import { useRef } from 'react'
import Image from 'next/image'
import { Camera, ChevronLeft, ChevronRight } from 'lucide-react'
import type { GalleryPhoto } from '@/content/gallery'

/** จำนวนกรอบว่างที่แสดงแทนตอนยังไม่มีรูปจริง */
const PLACEHOLDERS = 4

/**
 * แถบภาพเลื่อนแนวนอนแบบตั๋วเข้าซาลูน
 * ใช้ scroll-snap ของเบราว์เซอร์ ปัด/ลากบนมือถือได้เอง ปุ่มลูกศรมีไว้สำหรับเมาส์
 */
export function Gallery({ photos }: { photos: GalleryPhoto[] }) {
  const track = useRef<HTMLUListElement>(null)

  const scroll = (dir: 1 | -1) => {
    const el = track.current
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' })
  }

  const empty = photos.length === 0

  return (
    <div className="gallery">
      <ul ref={track} className="gallery-track" aria-label="ภาพบรรยากาศค่ายปีก่อน ๆ">
        {empty
          ? Array.from({ length: PLACEHOLDERS }, (_, i) => (
              <li key={i} className="gallery-ticket gallery-ticket--empty" aria-hidden={i > 0}>
                <div className="gallery-photo">
                  <Camera size={34} strokeWidth={1.4} aria-hidden="true" />
                  <span>ภาพบรรยากาศเร็ว ๆ นี้</span>
                </div>
                <div className="gallery-stub">
                  <span className="stamp">ADMIT ONE</span>
                  <span className="stamp">No. {String(i + 1).padStart(3, '0')}</span>
                </div>
              </li>
            ))
          : photos.map((photo, i) => (
              <li key={photo.src} className="gallery-ticket">
                <div className="gallery-photo">
                  <Image
                    src={photo.src} alt={photo.caption} fill
                    sizes="(max-width: 640px) 80vw, 380px"
                    style={{ objectFit: 'cover' }}
                  />
                </div>
                <div className="gallery-stub">
                  <span className="gallery-caption">{photo.caption}</span>
                  <span className="stamp">ICTP {photo.year} · No. {String(i + 1).padStart(3, '0')}</span>
                </div>
              </li>
            ))}
      </ul>

      {!empty && (
        <div className="gallery-controls">
          <button type="button" className="icon-btn" aria-label="ภาพก่อนหน้า" onClick={() => scroll(-1)}>
            <ChevronLeft size={18} />
          </button>
          <button type="button" className="icon-btn" aria-label="ภาพถัดไป" onClick={() => scroll(1)}>
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  )
}
