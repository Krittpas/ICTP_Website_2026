/** ต้องตรงกับ public.camp_email_role() ใน migration 002 */
export const STUDENT_EMAIL = /^s\d{5}@bj\.ac\.th$/

export const normalizeEmail = (raw: string) => raw.trim().toLowerCase()

export const isStudentEmail = (raw: string) => STUDENT_EMAIL.test(normalizeEmail(raw))

/**
 * อีเมลที่ยอมให้ "ลองล็อกอิน"
 *
 * ปล่อย @bj.ac.th ทุกรูปแบบผ่าน เพราะอีเมลพี่ค่ายไม่ได้ขึ้นต้นด้วย s
 * ถ้าบังคับรูปแบบเต็มตรงนี้ หน้าล็อกอินจะกลายเป็นเครื่องมือเดาว่าใครเป็นพี่ค่าย
 */
export function isCampEmail(raw: string) {
  const email = normalizeEmail(raw)
  return email.endsWith('@bj.ac.th') && email.length > 9
}
