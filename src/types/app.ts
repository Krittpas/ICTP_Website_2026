import type { Attachment } from '@/lib/announcements/attachments'

export type UserRole = 'student' | 'admin'

export interface SessionUser {
  id: string
  email: string
  displayName: string
  nickname: string
  /** path ของไฟล์ใน Storage — ใช้ตอนลบรูปเก่า ไม่ใช่ลิงก์ที่เปิดได้ */
  avatarUrl: string | null
  /** ลิงก์ชั่วคราวไว้แสดงรูป — ที่เก็บเป็นแบบส่วนตัวตั้งแต่ migration 018 */
  avatarSrc: string | null
  role: UserRole
  cityId: number | null
  seatIndex: number | null
}

export interface CampState {
  camp_open: boolean
  opens_at: string | null
  decrypt_unlocked: boolean
  decrypt_unlock_mode: 'auto' | 'manual' | null
}

export interface City {
  id: number
  slug: string
  name_th: string
  name_en: string
  blurb: string
  map_x: number
  map_y: number
  accent_hex: string
}

export interface CityProgress {
  city_id: number
  current_seat: number
  solved_count: number
  last_solved_at: string | null
}

export type SeatStatus = 'solved' | 'active' | 'locked'

export interface BoardSeat {
  seat_index: number
  display_name: string
  status: SeatStatus
  solved_at: string | null
}

/** ผลจาก get_my_puzzle() — สถานะเดียวเท่านั้นที่คืนข้อความโจทย์มา */
export type MyPuzzle =
  | { status: 'active'; puzzle_id: number; title: string; prompt: string; hint: string; media_url: string | null; seat_index: number; attempts_left: number }
  | { status: 'solved'; title: string; prompt: string; secret_code: string; seat_index: number }
  | { status: 'locked'; current_seat: number; seat_index: number; waiting_on: string }
  | { status: 'camp_closed'; seat_index: number }
  | { status: 'unassigned' }
  | { status: 'no_puzzle' }
  | { status: 'unauthorized' }

export type AnswerStatus =
  | 'correct' | 'incorrect' | 'already_solved' | 'locked'
  | 'not_your_puzzle' | 'camp_closed' | 'rate_limited' | 'unauthorized' | 'error'

export interface AnswerResult {
  status: AnswerStatus
  secret_code?: string
  attempts_left?: number
}

export interface Announcement {
  id: number
  title: string
  body: string
  creator_display_name: string
  created_at: string
  published_at: string
  updated_at: string | null
  is_pinned: boolean
  /** ไม่มีคอลัมน์นี้ถ้ายังไม่ได้รัน migration 011 */
  attachments?: Attachment[]
}

export interface AuditEntry {
  id: number
  action: string
  payload: Record<string, unknown>
  reason: string | null
  created_at: string
}

/** ผลจาก get_my_senior() / reveal_my_senior() — มีแค่ revealed ที่มีข้อมูลพี่รหัสติดมา */
export type SeniorReveal =
  | { status: 'revealed'; senior_name: string; senior_nickname: string; clue: string }
  | { status: 'incorrect'; attempts_left: number }
  | { status: 'ready' | 'locked' | 'admin' | 'unassigned' | 'not_solved' | 'no_match'
            | 'rate_limited' | 'unauthorized' | 'error' }

/**
 * พี่รหัสหนึ่งคน — คำใบ้ผูกอยู่ที่นี่ ไม่ใช่ที่น้อง (migration 016)
 * พี่หนึ่งคนมีน้องได้หลายคน แก้คำใบ้ครั้งเดียวน้องทุกคนของพี่คนนั้นเห็นตรงกัน
 */
export interface Senior {
  id: number
  name: string
  nickname: string
  clue: string
  /** จำนวนน้องที่จับคู่กับพี่คนนี้ */
  assigned: number
  /** จำนวนน้องที่เปิดเผยพี่รหัสไปแล้ว */
  revealed: number
}

/** หนึ่งข้อตรวจความพร้อม — count = 0 คือผ่าน (migration 017) */
export interface ReadinessCheck {
  key: string
  count: number
  /** ตัวอย่างรายการที่ยังไม่ผ่าน สูงสุด 8 รายการ */
  sample: string[]
}

export interface ReadinessReport {
  status: 'ok'
  students: number
  active_puzzles: number
  camp_open: boolean
  decrypt_unlocked: boolean
  opens_at: string | null
  checks: ReadinessCheck[]
}

/** สถานะหนึ่งเมืองสำหรับดูหน้างาน (migration 017) */
export interface CityStatus {
  city_id: number
  name_en: string
  current_seat: number
  solved: number
  total: number
  done: boolean
  last_solved_at: string | null
  /** ไม่มีใครตอบถูกมากี่นาทีแล้ว */
  idle_minutes: number
  waiting_name: string
  waiting_email: string
  /** ที่นั่งที่ถึงตามีคนนั่งอยู่จริงไหม — false = โซ่ค้างเพราะไม่มีคน */
  waiting_seated: boolean
}

/** หนึ่งแถวในหน้าพี่ค่าย — น้องหนึ่งคนกับพี่รหัสที่ตั้งไว้ (ถ้ามี) */
export interface SeniorMatchRow {
  email: string
  display_name: string
  city_id: number | null
  seat_index: number | null
  has_account: boolean
  senior_id: number | null
  senior_name: string | null
  senior_nickname: string | null
  clue: string | null
  revealed_at: string | null
}
