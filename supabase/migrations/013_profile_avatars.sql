-- ============================================================
-- 013 ทุกคนปรับแต่งโปรไฟล์ของตัวเองได้ + รูปโปรไฟล์
--
-- สิทธิ์แก้ display_name / nickname / avatar_url ของตัวเองมีอยู่แล้วตั้งแต่ 003
-- ที่เพิ่มคือที่เก็บรูปกับด่านตรวจค่าที่ใส่ได้
--
-- 1. ที่เก็บไฟล์ "avatars" — สาธารณะ (รูปโปรไฟล์ไม่ใช่ความลับ) ไฟล์ละไม่เกิน 2 MB
--    แต่ละคนเขียน/ลบได้เฉพาะโฟลเดอร์ <uuid ของตัวเอง>/ เท่านั้น
-- 2. profiles.avatar_url ต้องเป็นไฟล์ในโฟลเดอร์ของเจ้าของแถวเท่านั้น
--    RLS กับสิทธิ์ระดับคอลัมน์ตัดสินได้แค่ "ใครแก้แถวไหน" ไม่ได้ตัดสินว่าใส่ค่าอะไร
--    ไม่มีข้อนี้ = ใส่ URL ภายนอกหรือรูปของคนอื่นเป็นรูปโปรไฟล์ได้
-- 3. จำกัดความยาวชื่อเล่น
--
-- รันต่อจาก 012 ได้เลย
-- ============================================================

-- ── 1. ที่เก็บไฟล์ ────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 2097152, ARRAY['image/webp', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO UPDATE
  SET public             = true,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "read own avatar folder"   ON storage.objects;
DROP POLICY IF EXISTS "upload own avatar"        ON storage.objects;
DROP POLICY IF EXISTS "delete own avatar"        ON storage.objects;

-- อ่านผ่าน URL สาธารณะไม่ต้องมี policy · แต่การลบผ่าน API ต้องมีทั้ง SELECT และ DELETE
CREATE POLICY "read own avatar folder" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "upload own avatar" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "delete own avatar" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ── 2 + 3. ตรวจค่าที่ใส่ในโปรไฟล์ ─────────────────────────────
-- ค่าเก่าที่ไม่ตรงรูปแบบ (ถ้ามี) ล้างทิ้งก่อน ไม่อย่างนั้นเพิ่มข้อจำกัดไม่ได้
UPDATE public.profiles
   SET avatar_url = NULL
 WHERE avatar_url IS NOT NULL
   AND avatar_url !~ ('^' || id::text || '/[0-9a-f-]{36}\.(webp|jpg|png)$');

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_avatar_own_folder,
  ADD  CONSTRAINT profiles_avatar_own_folder
       CHECK (avatar_url IS NULL OR avatar_url ~ ('^' || id::text || '/[0-9a-f-]{36}\.(webp|jpg|png)$')),
  DROP CONSTRAINT IF EXISTS profiles_nickname_length,
  ADD  CONSTRAINT profiles_nickname_length CHECK (char_length(nickname) <= 50);
