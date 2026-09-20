/**
 * รูปโจทย์ปริศนา — ที่เก็บ "puzzles" เป็นแบบส่วนตัว (migration 012)
 * ดูได้ผ่านลิงก์ชั่วคราวที่ Storage ออกให้เฉพาะคนที่ policy อนุญาตเท่านั้น
 */
export const PUZZLE_BUCKET = 'puzzles'
/** ต้องตรงกับ allowed_mime_types / file_size_limit ใน migration 012 */
export const PUZZLE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
export const MAX_PUZZLE_IMAGE_BYTES = 10 * 1024 * 1024
/** อายุลิงก์รูป — หน้าปริศนาเปิดค้างได้ทั้งวัน รูปโหลดครั้งเดียวแล้วอยู่ในหน้าจอ */
export const PUZZLE_IMAGE_TTL = 6 * 60 * 60
