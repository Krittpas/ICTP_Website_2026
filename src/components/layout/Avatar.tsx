/**
 * รูปโปรไฟล์วงกลม — ไม่มีรูป = ตัวอักษรแรกของชื่อบนพื้นสีทองเหลือง
 *
 * รับเป็นลิงก์เท่านั้น ไม่ประกอบ URL เอง เพราะที่เก็บรูปเป็นแบบส่วนตัว (migration 018)
 * ลิงก์ชั่วคราวถูกขอไว้ตอนโหลดหน้าด้วยสิทธิ์ของเจ้าของรูปเอง (ดู getCurrentUser)
 */
export function Avatar({ src, name, size = 40 }: { src?: string | null; name: string; size?: number }) {
  // ตัวแรกที่ไม่ใช่สระหน้าไทย (เ แ โ ใ ไ) — "เอก" ควรได้ "อ" ไม่ใช่ "เ"
  const initial = (name.trim().replace(/^[เแโใไ]/, '')[0] ?? '?').toUpperCase()

  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.42 }} aria-hidden="true">
      {src
        // eslint-disable-next-line @next/next/no-img-element -- ลิงก์ชั่วคราว/blob ไม่ผ่านตัวย่อรูปของ Next
        ? <img src={src} alt="" width={size} height={size} />
        : initial}
    </span>
  )
}
