/**
 * ภาพบรรยากาศค่ายปีก่อน ๆ บนหน้าแรก
 *
 * วิธีเพิ่มรูป
 *   1. วางไฟล์ไว้ที่ public/gallery/ (แนะนำ .webp หรือ .jpg กว้างไม่เกิน 1600px)
 *   2. เพิ่มหนึ่งบรรทัดในรายการด้านล่าง เรียงตามลำดับที่อยากให้แสดง
 *
 * ยังไม่มีรูปเลย = หน้าแรกแสดงกรอบว่างพร้อมข้อความ "เร็ว ๆ นี้" แทน
 */
export interface GalleryPhoto {
  /** path ใต้ public เช่น '/gallery/2025-opening.webp' */
  src: string
  /** คำบรรยายใต้ภาพ และใช้เป็น alt ด้วย */
  caption: string
  /** ปีของค่าย (พ.ศ. หรือ ค.ศ. ก็ได้ แสดงตามที่ใส่) */
  year: string
}

export const GALLERY: GalleryPhoto[] = [
  // { src: '/gallery/2025-opening.webp', caption: 'พิธีเปิดค่าย', year: '2025' },
]
