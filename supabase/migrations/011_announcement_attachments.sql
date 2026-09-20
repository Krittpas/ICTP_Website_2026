-- ============================================================
-- 011 ประกาศแนบรูปภาพ/ไฟล์ได้ + ระบุได้ว่าประกาศมาจากใคร
--
-- 1. announcements.attachments — รายการไฟล์แนบ [{path, name, type, size}, ...]
--    เก็บแค่ที่อยู่ในที่เก็บไฟล์ ไม่เก็บตัวไฟล์ในตาราง · สูงสุด 10 ไฟล์ต่อประกาศ
-- 2. creator_display_name แก้ได้แล้ว — ใช้เป็นช่อง "ประกาศจาก" (เช่น ฝ่ายสันทนาการ)
--    ใครกดโพสต์จริงยังดูได้จาก created_by ซึ่งยังแก้ไม่ได้เหมือนเดิม
-- 3. ที่เก็บไฟล์ "announcements" — เปิดให้อ่านสาธารณะ เพราะประกาศแสดงบนหน้าแรกอยู่แล้ว
--    อัปโหลด/ลบได้เฉพาะพี่ค่าย · ไฟล์ละไม่เกิน 10 MB · รับเฉพาะรูปและเอกสารทั่วไป
--
-- รันต่อจาก 010 ได้เลย
-- ============================================================

-- ── 1 + 2. คอลัมน์ ────────────────────────────────────────────
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.announcements
  DROP CONSTRAINT IF EXISTS announcements_attachments_shape,
  ADD  CONSTRAINT announcements_attachments_shape
       CHECK (jsonb_typeof(attachments) = 'array' AND jsonb_array_length(attachments) <= 10),
  DROP CONSTRAINT IF EXISTS announcements_creator_name_length,
  ADD  CONSTRAINT announcements_creator_name_length
       CHECK (char_length(creator_display_name) <= 100);

-- เดิมแก้ได้แค่ title, body, is_pinned — created_by ยังแก้ไม่ได้เหมือนเดิม
GRANT UPDATE (creator_display_name, attachments) ON public.announcements TO authenticated;

-- ── 3. ที่เก็บไฟล์ ────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'announcements', 'announcements', true, 10485760,
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf', 'text/plain', 'application/zip',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- อ่านผ่าน URL สาธารณะไม่ต้องมี policy · แต่การลบผ่าน API ต้องมีทั้ง SELECT และ DELETE
DROP POLICY IF EXISTS "admin read announcement files"   ON storage.objects;
DROP POLICY IF EXISTS "admin upload announcement files" ON storage.objects;
DROP POLICY IF EXISTS "admin delete announcement files" ON storage.objects;

CREATE POLICY "admin read announcement files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'announcements' AND public.is_camp_admin());

CREATE POLICY "admin upload announcement files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'announcements' AND public.is_camp_admin());

CREATE POLICY "admin delete announcement files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'announcements' AND public.is_camp_admin());
