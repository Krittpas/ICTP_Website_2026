export interface PuzzleForEdit {
  exists: boolean
  title: string
  prompt: string
  hint: string
  secretCode: string
  isSolved: boolean
  /** ที่นั่งที่ปิดไว้จะถูกข้ามทั้งโซ่ และไม่ถูกนับในจำนวนปริศนาทั้งค่าย (migration 017) */
  isActive: boolean
  /** ชื่อน้องที่นั่งอยู่ที่นั่งนี้ — ว่าง = ยังไม่มีใครนั่ง */
  owner: string
  mediaPath: string | null
  /** ลิงก์ชั่วคราวไว้ดูตัวอย่างรูปในฟอร์ม */
  mediaUrl: string | null
}
