export interface PuzzleForEdit {
  exists: boolean
  title: string
  prompt: string
  hint: string
  secretCode: string
  isSolved: boolean
  mediaPath: string | null
  /** ลิงก์ชั่วคราวไว้ดูตัวอย่างรูปในฟอร์ม */
  mediaUrl: string | null
}
