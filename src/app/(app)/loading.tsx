/**
 * โครงหน้าระหว่างรอข้อมูล — ใช้กับทุกหน้าที่ต้องล็อกอิน
 *
 * หน้า /admin ยิงคำขอไปฐานข้อมูลแปดชุดพร้อมกัน ระหว่างนั้นถ้าไม่มีอะไรขึ้นเลย
 * จะดูเหมือนเว็บค้าง โดยเฉพาะบนเน็ตโรงเรียนที่ช้ากว่าปกติ
 *
 * เป็นแค่กล่องเปล่าที่เต้นอยู่ ไม่ได้เดาหน้าตาของหน้าจริง
 * เพราะแต่ละหน้าไม่เหมือนกันเลย เดาผิดแล้วจะกระตุกตอนของจริงมาแทน
 */
export default function Loading() {
  return (
    <div className="skeleton-page" aria-busy="true" aria-live="polite">
      <span className="sr-only">กำลังโหลด…</span>
      <div className="skeleton skeleton-title" />
      <div className="skeleton-grid">
        <div className="skeleton skeleton-card" />
        <div className="skeleton skeleton-card" />
        <div className="skeleton skeleton-card" />
      </div>
      <div className="skeleton skeleton-block" />
    </div>
  )
}
