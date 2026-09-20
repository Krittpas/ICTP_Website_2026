'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getActionAdmin } from '@/lib/auth/dal'
import { ANNOUNCEMENT_BUCKET, parseAttachments, type Attachment } from '@/lib/announcements/attachments'

export type AnnouncementState = { error?: string; success?: boolean } | null

/**
 * ตัวไฟล์ถูกอัปโหลดตรงจากเบราว์เซอร์ไปที่ Storage ก่อนแล้ว (ดู AnnouncementForm)
 * ที่นี่รับแค่รายการ path มาตรวจรูปแบบแล้วบันทึกลงตาราง
 * — server action รับ body ได้ไม่เกิน 1 MB และ Vercel ไม่เกิน 4.5 MB ส่งตัวไฟล์ผ่านที่นี่ไม่ได้
 */
function read(formData: FormData) {
  const title = String(formData.get('title') ?? '').trim()
  const body  = String(formData.get('body')  ?? '').trim()
  const from  = String(formData.get('from')  ?? '').trim()
  const isPinned = formData.get('is_pinned') === 'on'
  const attachments = parseAttachments(formData.get('attachments'))

  if (!title || !body)     return { error: 'กรุณากรอกหัวข้อและเนื้อหา' as const }
  if (title.length > 200)  return { error: 'หัวข้อยาวเกิน 200 ตัวอักษร' as const }
  if (body.length  > 5000) return { error: 'เนื้อหายาวเกิน 5000 ตัวอักษร' as const }
  if (from.length  > 100)  return { error: 'ชื่อผู้ประกาศยาวเกิน 100 ตัวอักษร' as const }
  if (!attachments)        return { error: 'ไฟล์แนบไม่ถูกต้อง ลองแนบใหม่อีกครั้ง' as const }
  return { title, body, from, isPinned, attachments }
}

function refresh() {
  revalidatePath('/senior/announcements')
  revalidatePath('/')
}

/** ลบไฟล์ออกจาก Storage — ลบไม่สำเร็จไม่ถือว่าประกาศบันทึกไม่สำเร็จ แค่เหลือไฟล์ค้าง */
async function removeFiles(supabase: Awaited<ReturnType<typeof createClient>>, files: Attachment[]) {
  if (files.length === 0) return
  const { error } = await supabase.storage.from(ANNOUNCEMENT_BUCKET).remove(files.map(f => f.path))
  if (error) console.error('remove announcement files:', error.message)
}

async function currentAttachments(supabase: Awaited<ReturnType<typeof createClient>>, id: number) {
  const { data } = await supabase.from('announcements').select('attachments').eq('id', id).single()
  return (data?.attachments ?? []) as Attachment[]
}

export async function createAnnouncementAction(_p: AnnouncementState, formData: FormData): Promise<AnnouncementState> {
  const fields = read(formData)
  if ('error' in fields) return fields

  const admin = await getActionAdmin()
  if (!admin) return { error: 'ไม่มีสิทธิ์' }

  const supabase = await createClient()
  const { error } = await supabase.from('announcements').insert({
    title: fields.title,
    body: fields.body,
    is_pinned: fields.isPinned,
    // "ประกาศจาก" — ว่าง = ชื่อพี่ค่ายที่กดโพสต์ · ใครโพสต์จริงยังดูได้จาก created_by
    creator_display_name: fields.from || admin.displayName || admin.email,
    created_by: admin.id,
    ...(fields.attachments.length > 0 && { attachments: fields.attachments }),
  })
  if (error) {
    // บันทึกไม่สำเร็จ ไฟล์ที่อัปโหลดไปแล้วไม่มีประกาศไหนอ้างถึง
    await removeFiles(supabase, fields.attachments)
    return { error: error.message }
  }

  refresh()
  return { success: true }
}

export async function updateAnnouncementAction(_p: AnnouncementState, formData: FormData): Promise<AnnouncementState> {
  const id = Number(formData.get('id'))
  if (!Number.isInteger(id) || id <= 0) return { error: 'ไม่พบประกาศนี้' }

  const fields = read(formData)
  if ('error' in fields) return fields
  const admin = await getActionAdmin()
  if (!admin) return { error: 'ไม่มีสิทธิ์' }

  const supabase = await createClient()
  const before = await currentAttachments(supabase, id)

  // updated_at / updated_by เขียนโดย trigger ฝั่งฐานข้อมูล ไม่ส่งมาจากที่นี่
  const { error } = await supabase.from('announcements')
    .update({
      title: fields.title,
      body: fields.body,
      is_pinned: fields.isPinned,
      creator_display_name: fields.from || admin.displayName || admin.email,
      attachments: fields.attachments,
    })
    .eq('id', id)
  if (error) return { error: error.message }

  // ไฟล์ที่ถูกเอาออกจากประกาศ ลบทิ้งจาก Storage ด้วย
  const kept = new Set(fields.attachments.map(a => a.path))
  await removeFiles(supabase, before.filter(a => !kept.has(a.path)))

  refresh()
  return { success: true }
}

export async function deleteAnnouncementAction(id: number) {
  if (!(await getActionAdmin())) return { error: 'ไม่มีสิทธิ์' }
  const supabase = await createClient()
  const files = await currentAttachments(supabase, id)
  const { error } = await supabase.from('announcements').delete().eq('id', id)
  if (error) return { error: error.message }
  await removeFiles(supabase, files)
  refresh()
  return { success: true }
}

export async function togglePinAction(id: number, pinned: boolean) {
  if (!(await getActionAdmin())) return { error: 'ไม่มีสิทธิ์' }
  const supabase = await createClient()
  const { error } = await supabase.from('announcements').update({ is_pinned: pinned }).eq('id', id)
  if (error) return { error: error.message }
  refresh()
  return { success: true }
}
