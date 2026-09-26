/**
 * ฉายาประจำตัวของคนในเว็บนี้ (migration 020)
 *
 * น้องค่ายคือ ม.4–6 ทุกคนเป็น "คาวบอย#รุ่น" หรือ "คาวเกิร์ล#รุ่น"
 * พี่ค่ายไม่ใช้ฉายานี้ แต่มียศของตัวเองสองระดับคือนายอำเภอกับผู้พิทักษ์
 *
 * อย่าสับสนกับ "หมายเลขประจำตัว #1–6" ซึ่งเป็นลำดับที่นั่งในเมือง (seat_index)
 * คนละตัวเลขกันคนละเรื่องกัน
 */

export type Cowhand = 'cowboy' | 'cowgirl'
export type DeputyRank = 'sheriff' | 'guardian'

/**
 * รุ่น = GENERATION_BASE − ชั้น ม. · ม.6 → 115 · ม.5 → 116 · ม.4 → 117
 * ปีถัดไปบวกเลขนี้ขึ้นหนึ่ง แล้วแก้ใน public.camp_generation() ของฐานข้อมูลให้ตรงกันด้วย
 */
export const GENERATION_BASE = 121

export const GRADES = [4, 5, 6] as const
export type Grade = (typeof GRADES)[number]

export const generationOf = (grade: number | null | undefined): number | null =>
  grade != null && grade >= 4 && grade <= 6 ? GENERATION_BASE - grade : null

export const COWHAND_LABEL: Record<Cowhand, string> = {
  cowboy: 'คาวบอย',
  cowgirl: 'คาวเกิร์ล',
}

export const DEPUTY_LABEL: Record<DeputyRank, string> = {
  sheriff: 'นายอำเภอ',
  guardian: 'ผู้พิทักษ์',
}

/** พี่ค่ายที่ยังไม่ได้ตั้งยศ — ไม่ปล่อยให้ป้ายว่าง */
export const DEPUTY_FALLBACK = 'พี่ค่าย'
/** น้องที่พี่ค่ายยังไม่ได้ตั้งฉายาให้ */
export const COWHAND_FALLBACK = 'ชาวเมือง'

export const isCowhand = (v: unknown): v is Cowhand => v === 'cowboy' || v === 'cowgirl'
export const isDeputyRank = (v: unknown): v is DeputyRank => v === 'sheriff' || v === 'guardian'

/** ฉายาของน้องหนึ่งคน เช่น "คาวบอย#115" — ขาดข้อมูลช่องไหนก็ยังได้ข้อความที่อ่านรู้เรื่อง */
export function cowhandTitle(cowhand: string | null, grade: number | null): string {
  const name = isCowhand(cowhand) ? COWHAND_LABEL[cowhand] : COWHAND_FALLBACK
  const gen = generationOf(grade)
  return gen ? `${name}#${gen}` : name
}

/** ฉายาจากเลขรุ่นที่คำนวณมาแล้ว — ใช้กับ get_city_board() ที่คืนรุ่นมาตรง ๆ */
export function cowhandTitleByGeneration(cowhand: string | null, generation: number | null): string {
  const name = isCowhand(cowhand) ? COWHAND_LABEL[cowhand] : COWHAND_FALLBACK
  return generation ? `${name}#${generation}` : name
}

/** ฉายาที่ต้องแสดงคู่กับชื่อคนนี้ — พี่ค่ายได้ยศ น้องได้คาวบอย/คาวเกิร์ล */
export function campTitle(u: {
  role: 'student' | 'admin'
  cowhand: string | null
  grade: number | null
  deputyRank: string | null
}): string {
  if (u.role === 'admin') {
    return isDeputyRank(u.deputyRank) ? DEPUTY_LABEL[u.deputyRank] : DEPUTY_FALLBACK
  }
  return cowhandTitle(u.cowhand, u.grade)
}

export const TITLE_RULE =
  'คาวบอยหรือคาวเกิร์ล แล้วเลือกชั้น ม.4–6 · เลขรุ่นคำนวณให้เอง (ม.6 คือรุ่น 115)'
