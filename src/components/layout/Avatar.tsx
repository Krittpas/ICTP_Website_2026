import { avatarUrl } from '@/lib/profile/avatar'

/**
 * รูปโปรไฟล์วงกลม — ไม่มีรูป = ตัวอักษรแรกของชื่อบนพื้นสีทองเหลือง
 * path = ไฟล์ใน Storage · src = ลิงก์ตรง (เช่นรูปที่เพิ่งเลือกแต่ยังไม่อัปโหลด) ใช้ก่อน path
 */
export function Avatar({ path, src, name, size = 40 }: {
  path?: string | null; src?: string; name: string; size?: number
}) {
  const url = src ?? avatarUrl(path)
  // ตัวแรกที่ไม่ใช่สระหน้าไทย (เ แ โ ใ ไ) — "เอก" ควรได้ "อ" ไม่ใช่ "เ"
  const initial = (name.trim().replace(/^[เแโใไ]/, '')[0] ?? '?').toUpperCase()

  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.42 }} aria-hidden="true">
      {url
        // eslint-disable-next-line @next/next/no-img-element -- รูปเล็กจาก Storage/blob ไม่ต้องผ่านตัวย่อรูป
        ? <img src={url} alt="" width={size} height={size} />
        : initial}
    </span>
  )
}
