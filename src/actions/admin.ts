'use server'

import { revalidatePath } from 'next/cache'
import { randomBytes } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActionAdmin } from '@/lib/auth/dal'
import { isStudentEmail, normalizeEmail } from '@/lib/auth/email'
import { STORAGE_KEY } from '@/lib/storage'
import { NAME_RULE, THAI_FULL_NAME, THAI_NICKNAME, tidyName } from '@/lib/profile/names'
import { TITLE_RULE } from '@/lib/profile/titles'
import { PUZZLE_BUCKET } from '@/lib/puzzles/media'
import type { PuzzleForEdit } from '@/lib/puzzles/edit'
import type { ReadinessReport } from '@/types/app'
import { BULK_CHUNK, parsePastedRows, type BulkStudentResult, type BulkStudentRow } from '@/lib/admin/rows'

type Result = { ok?: true; error?: string; message?: string; data?: Record<string, unknown> }

/** ทุกตัวในไฟล์นี้ยิง RPC ที่ตรวจ role ของผู้เรียกเองอีกชั้น — ที่นี่แค่กันให้เร็วขึ้น */
async function callRpc(fn: string, args: Record<string, unknown>): Promise<Result> {
  if (!(await getActionAdmin())) return { error: 'ไม่มีสิทธิ์' }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc(fn, args)
  if (error) return { error: error.message }

  const { status, rows } = (data ?? {}) as { status?: string; rows?: number[] }
  if (status === 'forbidden')       return { error: 'ไม่มีสิทธิ์' }
  if (status === 'reason_required') return { error: 'กรุณาระบุเหตุผล' }
  if (status === 'already_started') return { error: 'ค่ายเริ่มแล้ว จัดเมืองใหม่ไม่ได้' }
  if (status === 'already_solved')  return { error: 'ที่นั่งนี้ผ่านไปแล้ว' }
  if (status === 'not_found')       return { error: 'ไม่พบที่นั่งนี้' }
  if (status === 'prompt_required') return { error: 'กรุณาใส่โจทย์ด่านสุดท้าย' }
  if (status === 'answer_required') return { error: 'ปริศนาข้อใหม่ต้องใส่เฉลย' }
  if (status === 'invalid_media')   return { error: 'รูปโจทย์ไม่ถูกต้อง ลองแนบใหม่อีกครั้ง' }
  if (status === 'invalid_code')    return { error: 'รหัสลับยาวเกิน 100 ตัวอักษร' }
  if (status === 'empty')           return { error: 'ยังไม่มีข้อมูลให้บันทึก' }
  if (status === 'match_not_found') return { error: 'ไม่พบคู่พี่รหัสนี้' }
  if (status === 'name_required')   return { error: 'กรุณาใส่ชื่อพี่รหัส (ไม่เกิน 100 ตัวอักษร)' }
  if (status === 'nickname_too_long') return { error: 'ชื่อเล่นพี่ยาวเกิน 50 ตัวอักษร' }
  if (status === 'clue_too_long')   return { error: 'คำใบ้ยาวเกิน 1000 ตัวอักษร' }
  if (status === 'duplicate_senior') return { error: 'มีพี่รหัสชื่อและชื่อเล่นนี้อยู่แล้ว' }
  if (status === 'senior_not_found') return { error: 'ไม่พบพี่รหัสคนนี้' }
  if (status === 'invalid_email')   return { error: 'อีเมลน้องต้องเป็น sXXXXX@bj.ac.th' }
  if (status === 'senior_in_use')   return {
    error: `ลบไม่ได้ ยังมีน้องผูกกับพี่คนนี้อยู่ ${(data as { count?: number })?.count ?? ''} คน — ย้ายน้องไปพี่คนอื่นก่อน`,
  }
  if (status === 'no_change')       return { error: 'ค่าเดิมอยู่แล้ว ไม่มีอะไรเปลี่ยน' }
  if (status === 'invalid_seat')    return { error: 'เมืองหรือที่นั่งปลายทางไม่ถูกต้อง' }
  if (status === 'student_not_found') return { error: 'ไม่พบบัญชีน้องค่ายอีเมลนี้' }
  if (status === 'not_a_student')   return { error: 'ออกรหัสผ่านใหม่ได้เฉพาะบัญชีน้องค่าย' }
  if (status === 'invalid_names')   return { error: `บรรทัดที่ ${(rows ?? []).join(', ')} ไม่ถูกต้อง — ${NAME_RULE} (ไม่ได้บันทึกสักแถว)` }
  if (status === 'invalid_titles')  return { error: `บรรทัดที่ ${(rows ?? []).join(', ')} ไม่ถูกต้อง — ${TITLE_RULE} (ไม่ได้บันทึกสักแถว)` }
  if (status === 'invalid_rank')    return { error: 'ยศไม่ถูกต้อง' }
  if (status === 'admin_not_found') return { error: 'ไม่พบบัญชีพี่ค่ายอีเมลนี้' }
  if (status === 'unknown_students') return { error: `บรรทัดที่ ${(rows ?? []).join(', ')} ไม่พบบัญชีน้องค่ายอีเมลนี้ (ไม่ได้บันทึกสักแถว)` }
  if (status === 'invalid_rows')    return {
    error: `บรรทัดที่ ${(rows ?? []).join(', ')} ไม่ถูกต้อง — อีเมลต้องเป็น sXXXXX@bj.ac.th และต้องมีชื่อพี่ (ไม่ได้บันทึกสักแถว)`,
  }
  if (status !== 'ok')              return { error: `ทำรายการไม่สำเร็จ (${status ?? 'unknown'})` }

  revalidatePath('/admin')
  revalidatePath('/senior/puzzles')
  revalidatePath('/senior/decrypt')
  revalidatePath('/camp')
  revalidatePath('/')
  return { ok: true, data: data as Record<string, unknown> }
}

export async function setCampOpenAction(open: boolean, opensAt: string | null, reason: string) {
  return callRpc('admin_set_camp_open', {
    p_open: open,
    p_opens_at: opensAt || null,
    p_reason: reason.trim() || null,
  })
}

export async function setDecryptAction(unlocked: boolean, reason: string) {
  return callRpc('admin_set_decrypt', { p_unlocked: unlocked, p_reason: reason.trim() })
}

export async function forceSolveSeatAction(cityId: number, seatIndex: number, reason: string) {
  return callRpc('admin_force_solve_seat', {
    p_city_id: cityId, p_seat_index: seatIndex, p_reason: reason.trim(),
  })
}

export async function assignParticipantsAction(seed: string, reason: string) {
  return callRpc('admin_assign_participants', { p_seed: seed.trim() || 'camp2026', p_reason: reason.trim() || null })
}

export async function upsertPuzzleAction(_p: Result | null, formData: FormData): Promise<Result> {
  const cityId = Number(formData.get('city_id'))
  const seat   = Number(formData.get('seat_index'))
  if (!Number.isInteger(cityId) || !Number.isInteger(seat)) return { error: 'เมืองหรือที่นั่งไม่ถูกต้อง' }

  const title = String(formData.get('title') ?? '').trim()
  if (!title) return { error: 'กรุณาใส่ชื่อด่าน' }

  // รูปโจทย์: ไม่ส่งมา = ไม่เปลี่ยน · '' = เอาออก · path = รูปใหม่ที่อัปโหลดจากเบราว์เซอร์แล้ว
  const rawMedia = formData.get('media_path')
  const media = rawMedia === null ? null : String(rawMedia)
  if (media && !STORAGE_KEY.test(media)) return { error: 'รูปโจทย์ไม่ถูกต้อง ลองแนบใหม่อีกครั้ง' }

  // รหัสลับ: ไม่ส่งมา = ไม่เปลี่ยน · '' = สั่งให้ฐานข้อมูลสุ่มใหม่ 18 อักขระ
  const rawCode = formData.get('secret_code')
  const code = rawCode === null ? null : String(rawCode).trim()
  if (code && code.length > 100) return { error: 'รหัสลับยาวเกิน 100 ตัวอักษร' }

  const res = await callRpc('admin_upsert_puzzle', {
    p_city_id: cityId,
    p_seat_index: seat,
    p_title: title,
    p_prompt: String(formData.get('prompt') ?? '').trim(),
    p_hint: String(formData.get('hint') ?? '').trim(),
    // ปล่อยว่าง = ไม่เปลี่ยนเฉลยเดิม
    p_answer: String(formData.get('answer') ?? '').trim(),
    p_secret_code: code,
    p_media_url: media,
  })
  if (!res.ok) return res

  // รูปเก่าที่ถูกแทนที่หรือเอาออก ลบจาก Storage ด้วย — ลบไม่สำเร็จแค่เหลือไฟล์ค้าง ไม่กระทบปริศนา
  const replaced = res.data?.replaced_media
  if (typeof replaced === 'string' && STORAGE_KEY.test(replaced)) {
    const supabase = await createClient()
    const { error } = await supabase.storage.from(PUZZLE_BUCKET).remove([replaced])
    if (error) console.error('remove old puzzle image:', error.message)
  }
  // รหัสลับที่ฐานข้อมูลสุ่มให้ ส่งกลับไปให้ฟอร์มแสดงทันทีโดยไม่ต้องโหลดใหม่
  return { ok: true, data: { secret_code: String(res.data?.secret_code ?? '') } }
}


/** ปริศนาเดิมของที่นั่งนี้ — เติมลงฟอร์มให้แก้ต่อได้ เฉลยไม่ถูกส่งกลับมา */
export async function getPuzzleForEditAction(cityId: number, seat: number): Promise<PuzzleForEdit | { error: string }> {
  if (!(await getActionAdmin())) return { error: 'ไม่มีสิทธิ์' }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('admin_get_puzzle', { p_city_id: cityId, p_seat_index: seat })
  if (error) return { error: error.message }

  const d = (data ?? {}) as Record<string, unknown>
  if (d.status === 'not_found') {
    return {
      exists: false, title: '', prompt: '', hint: '', secretCode: '',
      isSolved: false, isActive: true, owner: '', mediaPath: null, mediaUrl: null,
    }
  }
  if (d.status !== 'ok') return { error: 'ไม่มีสิทธิ์' }

  const mediaPath = typeof d.media_url === 'string' ? d.media_url : null
  let mediaUrl: string | null = null
  if (mediaPath) {
    const signed = await supabase.storage.from(PUZZLE_BUCKET).createSignedUrl(mediaPath, 60 * 60)
    mediaUrl = signed.data?.signedUrl ?? null
  }

  return {
    exists: true,
    title: String(d.title ?? ''),
    prompt: String(d.prompt ?? ''),
    hint: String(d.hint ?? ''),
    secretCode: String(d.secret_code ?? ''),
    isSolved: d.is_solved === true,
    // ยังไม่ได้รัน migration 017 = ไม่มีคีย์นี้ ถือว่าเปิดอยู่ตามเดิม
    isActive: d.is_active !== false,
    owner: String(d.owner ?? ''),
    mediaPath,
    mediaUrl,
  }
}

/**
 * ปิด/เปิดที่นั่ง — ที่นั่งที่ไม่มีคนนั่งทำให้โซ่ทั้งเมืองค้างถาวร (migration 017)
 * ปิดแล้วโซ่ข้ามไปคนถัดไปเอง และจำนวนปริศนาทั้งค่ายลดลงตามจริง
 */
export async function setSeatActiveAction(cityId: number, seat: number, active: boolean, reason: string): Promise<Result> {
  const res = await callRpc('admin_set_seat_active', {
    p_city_id: cityId, p_seat_index: seat, p_active: active, p_reason: reason.trim(),
  })
  if (!res.ok) return res
  const owner = String(res.data?.owner ?? '')
  return {
    ok: true,
    message: active
      ? 'เปิดที่นั่งนี้กลับแล้ว โซ่จะวนกลับมาที่นี่'
      : `ปิดที่นั่งนี้แล้ว โซ่ข้ามไปคนถัดไป${owner ? ` · ${owner} จะไม่เห็นปริศนาอีก` : ''}`,
  }
}

/**
 * ย้ายน้องรายคน — เมือง/ที่นั่งเป็น null ทั้งคู่ = เอาออกจากที่นั่ง
 * ที่นั่งปลายทางมีคนอยู่แล้ว ฐานข้อมูลจะสลับที่ให้ ไม่มีใครหลุดที่นั่งเงียบ ๆ
 */
export async function moveStudentAction(
  email: string, cityId: number | null, seat: number | null, reason: string,
): Promise<Result> {
  const clean = normalizeEmail(email)
  if (!isStudentEmail(clean)) return { error: 'อีเมลน้องต้องเป็น sXXXXX@bj.ac.th' }

  const res = await callRpc('admin_move_student', {
    p_email: clean, p_city_id: cityId, p_seat_index: seat, p_reason: reason.trim(),
  })
  if (!res.ok) return res

  const swapped = String(res.data?.swapped_with ?? '')
  const kicked = res.data?.swapped_to_none === true
  const solved = res.data?.seat_solved === true

  const parts = [cityId ? `ย้ายไปเมือง ${String(cityId).padStart(2, '0')} · หมายเลขประจำตัว #${seat}` : 'เอาออกจากที่นั่งแล้ว']
  if (swapped) parts.push(kicked ? `${swapped} หลุดจากที่นั่งนี้ ต้องจัดที่ให้ใหม่` : `สลับที่กับ ${swapped}`)
  if (solved) parts.push('ที่นั่งนี้ถูกไขผ่านไปแล้ว น้องจะเห็นรหัสลับของที่นั่งนี้ทันที')
  return { ok: true, message: parts.join(' · ') }
}

/** ตรวจความพร้อมก่อนวันงาน — รวมทุกอย่างที่ต้องครบไว้ในคำขอเดียว (migration 017) */
export async function getReadinessAction(): Promise<ReadinessReport | { error: string }> {
  if (!(await getActionAdmin())) return { error: 'ไม่มีสิทธิ์' }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('admin_readiness')
  if (error) return { error: 'ยังตรวจไม่ได้ — ต้องรัน migration 017 ก่อน' }

  const report = data as ReadinessReport | { status?: string }
  if (report?.status !== 'ok') return { error: 'ไม่มีสิทธิ์' }
  return report as ReadinessReport
}

/**
 * สุ่มรหัสลับใหม่ให้ทุกข้อรวดเดียว — ใช้ตอนตั้งค่าครั้งแรกเพื่อทิ้งรหัสตัวอย่างจาก seed
 * ข้อที่มีคนไขผ่านไปแล้วถูกข้าม เพราะน้องจดรหัสเดิมไปใช้กับเครื่องถอดรหัสแล้ว
 */
export async function regenerateSecretCodesAction(reason: string): Promise<Result> {
  const res = await callRpc('admin_regenerate_secret_codes', { p_reason: reason.trim() || null })
  if (!res.ok) return res

  const changed = Number(res.data?.changed ?? 0)
  const skipped = Number(res.data?.skipped ?? 0)
  return {
    ok: true,
    message: `สุ่มรหัสใหม่ให้ ${changed} ข้อ${skipped > 0 ? ` · ข้าม ${skipped} ข้อที่ไขผ่านไปแล้ว` : ''}`,
  }
}

/**
 * สร้างหรือแก้พี่รหัสหนึ่งคน — คำใบ้อยู่ที่นี่ (migration 016)
 * ช่อง id ว่าง = สร้างใหม่ · มีค่า = แก้คนเดิม
 */
export async function upsertSeniorAction(_p: Result | null, formData: FormData): Promise<Result> {
  const rawId = String(formData.get('senior_id') ?? '').trim()
  const id = rawId ? Number(rawId) : null
  if (id !== null && !Number.isInteger(id)) return { error: 'ไม่พบพี่รหัสคนนี้' }

  const name = String(formData.get('name') ?? '').trim()
  if (!name) return { error: 'กรุณาใส่ชื่อพี่รหัส' }

  const res = await callRpc('admin_upsert_senior', {
    p_id: id,
    p_name: name,
    p_nickname: String(formData.get('nickname') ?? '').trim(),
    p_clue: String(formData.get('clue') ?? '').trim(),
  })
  return res.ok ? { ok: true, message: id ? 'แก้พี่รหัสแล้ว' : 'เพิ่มพี่รหัสแล้ว', data: res.data } : res
}

export async function deleteSeniorAction(id: number) {
  return callRpc('admin_delete_senior', { p_id: id })
}

/** จับคู่น้องหนึ่งคนเข้ากับพี่ที่มีอยู่แล้ว */
export async function assignSeniorAction(_p: Result | null, formData: FormData): Promise<Result> {
  const email = String(formData.get('email') ?? '').trim()
  const seniorId = Number(formData.get('senior_id'))
  if (!Number.isInteger(seniorId) || seniorId <= 0) return { error: 'กรุณาเลือกพี่รหัส' }

  const res = await callRpc('admin_assign_senior', { p_email: email, p_senior_id: seniorId })
  return res.ok ? { ok: true, message: 'จับคู่แล้ว' } : res
}

/**
 * วางจากสเปรดชีต — หนึ่งบรรทัดต่อหนึ่งคน
 * อีเมลน้อง | ชื่อพี่ | ชื่อเล่นพี่ | คำใบ้
 * คั่นด้วยแท็บ (คัดลอกจาก Google Sheets มาได้เลย) หรือจุลภาค — ช่องคำใบ้มีจุลภาคได้
 * ฐานข้อมูลสร้างพี่ที่ยังไม่มีให้เอง แล้วผูกน้องเข้ากับพี่คนนั้นในทรานแซกชันเดียว
 */
export async function upsertSeniorMatchesAction(_p: Result | null, formData: FormData): Promise<Result> {
  const rows = parseSeniorRows(String(formData.get('bulk') ?? ''))
  if (rows.length === 0) return { error: 'ยังไม่มีข้อมูลให้บันทึก' }

  const res = await callRpc('admin_upsert_senior_matches', { p_rows: rows })
  return res.ok ? { ok: true, message: `จับคู่แล้ว ${rows.length} คน` } : res
}

/** แถวที่วางมาในแผงรายชื่อน้อง — ห้าช่องคงที่ ไม่มีช่องยาวท้ายเหมือนคำใบ้พี่รหัส */
function parseTitleRows(text: string) {
  return parsePastedRows(text).map(({ line, cells }) => ({
    line,
    email: (cells[0] ?? '').trim(),
    name: tidyName(cells[1] ?? ''),
    nickname: tidyName(cells[2] ?? ''),
    cowhand: parseCowhand(cells[3] ?? ''),
    grade: parseGrade(cells[4] ?? ''),
  }))
}

function parseSeniorRows(text: string) {
  return parsePastedRows(text).map(({ line, cells, rest }) => ({
    line, email: cells[0] ?? '', name: cells[1] ?? '', nickname: cells[2] ?? '', clue: rest,
  }))
}

/** แปลงคำที่พี่ค่ายพิมพ์ในสเปรดชีตเป็นค่าที่ฐานข้อมูลรับ — ว่าง = ไม่เปลี่ยนของเดิม */
function parseCowhand(raw: string): string {
  const v = raw.trim().toLowerCase()
  if (!v) return ''
  if (v === 'cowboy'  || v === 'ชาย' || v === 'คาวบอย'   || v === 'ช' || v === 'm') return 'cowboy'
  if (v === 'cowgirl' || v === 'หญิง' || v === 'คาวเกิร์ล' || v === 'ญ' || v === 'f') return 'cowgirl'
  // ค่าที่แปลไม่ออกส่งดิบไปให้ฐานข้อมูลปฏิเสธ จะได้บอกบรรทัดที่ผิดได้ ไม่ใช่เงียบ ๆ ข้ามไป
  return v
}

/** ชั้นเรียนรับได้ทั้ง "5" และ "ม.5" — ว่าง = ไม่เปลี่ยนของเดิม */
function parseGrade(raw: string): string {
  const v = raw.trim().replace(/^ม\.?\s*/, '')
  return v
}

/**
 * ตั้งชื่อ-นามสกุล ชื่อเล่น และฉายาของน้อง — น้องแก้เองไม่ได้ (migration 014 · 020)
 * ช่องวาง: หนึ่งบรรทัดต่อหนึ่งคน
 *   อีเมลน้อง | ชื่อ-นามสกุล | ชื่อเล่น | คาวบอย/คาวเกิร์ล | ชั้น ม. (แท็บหรือจุลภาค)
 * สองช่องท้ายเป็นช่องเสริม เว้นไว้ = ฉายาเดิมไม่ถูกแตะ
 */
export async function setStudentNamesAction(_p: Result | null, formData: FormData): Promise<Result> {
  const bulk = String(formData.get('bulk') ?? '')
  const rows = bulk.trim()
    ? parseTitleRows(bulk)
    : [{
        line: 1,
        email: String(formData.get('email') ?? '').trim(),
        name: tidyName(String(formData.get('name') ?? '')),
        nickname: tidyName(String(formData.get('nickname') ?? '')),
        cowhand: parseCowhand(String(formData.get('cowhand') ?? '')),
        grade: parseGrade(String(formData.get('grade') ?? '')),
      }]

  // ตรวจก่อนส่ง ให้บอกบรรทัดที่ผิดได้ทันที — ฐานข้อมูลตรวจซ้ำอีกชั้น
  const bad = rows.filter(r => !THAI_FULL_NAME.test(r.name) || r.name.length > 100 || !THAI_NICKNAME.test(r.nickname))
  if (bad.length) {
    return { error: bulk.trim() ? `บรรทัดที่ ${bad.map(r => r.line).join(', ')} ไม่ถูกต้อง — ${NAME_RULE}` : NAME_RULE }
  }

  // ฉายาเป็นช่องเสริม แต่ถ้าใส่มาต้องถูกต้อง — ฐานข้อมูลตรวจซ้ำอีกชั้น
  const badTitle = rows.filter(r =>
    (r.cowhand && r.cowhand !== 'cowboy' && r.cowhand !== 'cowgirl') ||
    (r.grade && !/^[456]$/.test(r.grade)))
  if (badTitle.length) {
    return {
      error: bulk.trim()
        ? `บรรทัดที่ ${badTitle.map(r => r.line).join(', ')} ไม่ถูกต้อง — ${TITLE_RULE}`
        : TITLE_RULE,
    }
  }

  const res = await callRpc('admin_set_student_names', { p_rows: rows })
  if (res.ok) revalidatePath('/', 'layout')
  return res.ok ? { ok: true, message: `บันทึกแล้ว ${rows.length} คน` } : res
}

/**
 * ตั้งยศให้พี่ค่าย — นายอำเภอหรือผู้พิทักษ์ (migration 020)
 * ฟังก์ชันนี้ไม่ได้แจกสิทธิ์ admin ให้ใคร ตั้งได้เฉพาะบัญชีที่เป็น admin อยู่แล้ว
 */
export async function setDeputyRankAction(email: string, rank: string): Promise<Result> {
  const res = await callRpc('admin_set_deputy_rank', {
    p_email: normalizeEmail(email),
    p_rank: rank.trim(),
  })
  if (res.ok) revalidatePath('/', 'layout')
  return res
}

export async function deleteSeniorMatchAction(email: string) {
  return callRpc('admin_delete_senior_match', { p_email: email })
}

function generatePassword() {
  // ตัดตัวที่อ่านสับสนออก (0/O, 1/l/I) เพราะรหัสนี้ต้องพิมพ์ตามจากกระดาษ
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from(randomBytes(10)).map(b => chars[b % chars.length]).join('')
}

/**
 * ออกรหัสผ่านใหม่ให้น้องที่ลืมรหัส — คืนรหัสใหม่ครั้งเดียว ต้องจดทันที
 * ฐานข้อมูลเป็นคนตัดสินสิทธิ์และบันทึกประวัติ (admin_begin_password_reset)
 * ที่นี่แค่ตั้งรหัสจริงด้วย service role ซึ่งเรียกจากฝั่ง server เท่านั้น
 */
export async function resetStudentPasswordAction(email: string): Promise<Result & { password?: string }> {
  const res = await callRpc('admin_begin_password_reset', { p_email: email })
  if (!res.ok) return res

  const userId = res.data?.user_id
  if (typeof userId !== 'string') return { error: 'ไม่พบบัญชีน้องค่ายอีเมลนี้' }

  const password = generatePassword()
  const { error } = await createAdminClient().auth.admin.updateUserById(userId, { password })
  if (error) return { error: error.message }

  return { ok: true, password }
}

/**
 * สร้างบัญชีน้องหลายคนในคำขอเดียว — ใช้กับการวางจากสเปรดชีต
 * คืนรหัสผ่านของทุกคนกลับไปครั้งเดียว ฝั่งเบราว์เซอร์รวบรวมแล้วให้ดาวน์โหลดเป็นไฟล์
 * แถวไหนพลาด (เช่นมีบัญชีอยู่แล้ว) ไม่ทำให้แถวอื่นล้ม
 */
export async function createStudentsChunkAction(rows: BulkStudentRow[]): Promise<{ results?: BulkStudentResult[]; error?: string }> {
  if (!(await getActionAdmin())) return { error: 'ไม่มีสิทธิ์' }
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > BULK_CHUNK) return { error: 'ข้อมูลไม่ถูกต้อง' }

  const admin = createAdminClient()
  const results: BulkStudentResult[] = []

  for (const row of rows) {
    const email = normalizeEmail(String(row.email ?? ''))
    const name = tidyName(String(row.name ?? ''))
    const nickname = tidyName(String(row.nickname ?? ''))
    const base = { line: row.line, email, name, nickname }

    if (!isStudentEmail(email)) { results.push({ ...base, error: 'อีเมลต้องเป็น sXXXXX@bj.ac.th' }); continue }
    if (!THAI_FULL_NAME.test(name) || name.length > 100 || !THAI_NICKNAME.test(nickname)) {
      results.push({ ...base, error: NAME_RULE }); continue
    }

    const password = generatePassword()
    const { error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { display_name: name, nickname },
    })
    results.push(error
      ? { ...base, error: /already|registered|exists/i.test(error.message) ? 'มีบัญชีอีเมลนี้อยู่แล้ว' : error.message }
      : { ...base, password })
  }

  revalidatePath('/admin')
  return { results }
}

/** สร้างบัญชีให้น้องค่าย — คืนรหัสผ่านครั้งเดียว พี่ค่ายต้องจดไปแจก */
export async function createStudentAction(email: string, displayName: string, nickname: string): Promise<Result & { password?: string }> {
  if (!(await getActionAdmin())) return { error: 'ไม่มีสิทธิ์' }

  const clean = normalizeEmail(email)
  const name = tidyName(displayName)
  const nick = tidyName(nickname)
  if (!isStudentEmail(clean)) return { error: 'ต้องเป็นอีเมลนักเรียน sXXXXX@bj.ac.th' }
  if (!THAI_FULL_NAME.test(name) || name.length > 100 || !THAI_NICKNAME.test(nick)) return { error: NAME_RULE }

  const password = generatePassword()
  const admin = createAdminClient()
  const { error } = await admin.auth.admin.createUser({
    email: clean,
    password,
    email_confirm: true,
    // handle_new_user() อ่านสองค่านี้ไปตั้งในโปรไฟล์ (migration 014)
    user_metadata: { display_name: name, nickname: nick },
  })
  if (error) return { error: error.message }

  revalidatePath('/admin')
  return { ok: true, password }
}
