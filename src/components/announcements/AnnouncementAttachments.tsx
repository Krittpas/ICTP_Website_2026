import { Download, FileText } from 'lucide-react'
import { attachmentUrl, formatBytes, isImage, type Attachment } from '@/lib/announcements/attachments'

/**
 * รูปและไฟล์แนบใต้เนื้อหาประกาศ
 * รูปเดียวแสดงเต็มความกว้าง หลายรูปเรียงเป็นตาราง กดที่รูปเพื่อเปิดขนาดเต็ม
 * ใช้ <img> ธรรมดาเพราะไม่รู้ขนาดรูปล่วงหน้า และโปสเตอร์แนวตั้งต้องเห็นครบทั้งใบ ไม่ถูกครอป
 */
export function AnnouncementAttachments({ items, limitImages }: { items?: Attachment[]; limitImages?: number }) {
  if (!items?.length) return null
  const images = items.filter(isImage)
  const files = items.filter(a => !isImage(a))
  const shown = limitImages ? images.slice(0, limitImages) : images
  const hidden = images.length - shown.length

  return (
    <div className="ann-attachments">
      {shown.length > 0 && (
        <div className="ann-images" data-count={Math.min(shown.length, 3)}>
          {shown.map((img, i) => (
            <a key={img.path} href={attachmentUrl(img)} target="_blank" rel="noopener noreferrer" className="ann-image">
              {/* eslint-disable-next-line @next/next/no-img-element -- ไม่รู้สัดส่วนรูปล่วงหน้า */}
              <img src={attachmentUrl(img)} alt={img.name} loading="lazy" decoding="async" />
              {hidden > 0 && i === shown.length - 1 && <span className="ann-image-more">+{hidden}</span>}
            </a>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <ul className="ann-files">
          {files.map(f => (
            <li key={f.path}>
              <a href={attachmentUrl(f, f.name)} className="ann-file">
                <FileText size={18} aria-hidden="true" />
                <span className="ann-file-name">{f.name}</span>
                <span className="ann-file-size">{formatBytes(f.size)}</span>
                <Download size={15} aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
