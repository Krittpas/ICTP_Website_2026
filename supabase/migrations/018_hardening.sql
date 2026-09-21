-- ============================================================
-- 018 ปิดช่องที่เหลือทั้งหมด
--
-- 1. get_puzzle_totals() เรียกไม่ได้เมื่อล็อกอินแล้ว (บั๊กสิทธิ์ที่ซ่อนอยู่ตั้งแต่ 008)
--    006 สร้างฟังก์ชันนี้หลัง 003 จึงไม่เคยได้ GRANT ให้ authenticated
--    มันทำงานได้เพราะ Postgres ให้ PUBLIC เรียกฟังก์ชันใหม่ได้เองเป็นค่าเริ่มต้น
--    แล้ว 008 ถอนสิทธิ์ PUBLIC ทิ้งทั้งสคีมา ตั้งแต่นั้นน้องที่ล็อกอินเรียกไม่ได้เลย
--    หน้าเว็บไม่แจ้ง error แต่ถอยไปเดาว่า "เมืองละ 6 ที่นั่ง" เงียบ ๆ
--    = ตัวเลขความคืบหน้าและกุญแจทองคำเพี้ยนทันทีที่มีที่นั่งถูกปิด (017)
--
-- 2. โปรไฟล์เพื่อนร่วมเมืองอ่านได้ทั้งแถว
--    policy เดิมเปิดให้เห็นแถวของทุกคนในเมืองเดียวกัน และ GRANT SELECT ไม่ได้จำกัดคอลัมน์
--    ยิง PostgREST ตรง ๆ จึงอ่านอีเมลและรหัสนักเรียนของเพื่อนได้ ทั้งที่หน้าเว็บไม่เคยใช้
--    (ชื่อเพื่อนในแถบลำดับคาวบอยมาจาก get_city_board ซึ่งคืนแค่ชื่อกับสถานะ)
--
-- 3. รูปโปรไฟล์อยู่ในที่เก็บสาธารณะ — ใครมีลิงก์ก็เปิดดูได้โดยไม่ต้องล็อกอิน
--    เป็นรูปของนักเรียน ควรต้องล็อกอินก่อนเสมอ
--    หน้าเว็บแสดงรูปของ "ตัวเอง" ที่เดียว จึงเปลี่ยนเป็นที่เก็บส่วนตัว + ลิงก์ชั่วคราวได้เลย
--
-- 4. answer_text ยาวได้ไม่จำกัด — ยิง RPC ตรง ๆ ด้วยสตริงหลายเมกะไบต์ซ้ำ ๆ ทำให้ตารางบวม
--
-- 5. กวาดสิทธิ์ EXECUTE ทั้งสคีมาอีกรอบ เผื่อมีฟังก์ชันไหนหลุดเป็นของ PUBLIC
--
-- รันต่อจาก 017 ได้เลย
-- ============================================================

-- ============================================================
-- 1. สิทธิ์ที่หายไป
-- ============================================================
GRANT EXECUTE ON FUNCTION public.get_puzzle_totals() TO authenticated;

-- ============================================================
-- 2. โปรไฟล์ — เห็นได้เฉพาะของตัวเอง
-- ============================================================
DROP POLICY IF EXISTS "read own or same city profile" ON public.profiles;
DROP POLICY IF EXISTS "read own profile"              ON public.profiles;

CREATE POLICY "read own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_camp_admin());

-- คอลัมน์ที่ไม่มีใครอ่านผ่าน PostgREST เลย ไม่ต้องให้สิทธิ์อ่าน
-- (student_code ยังอ่านได้ผ่าน RPC ของพี่ค่ายตามปกติ เพราะ SECURITY DEFINER ข้าม GRANT)
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT  SELECT (id, email, display_name, nickname, avatar_url, role, city_id, seat_index, created_at)
  ON public.profiles TO authenticated;

-- ============================================================
-- 3. รูปโปรไฟล์เป็นของส่วนตัว
--    policy "read own avatar folder" จาก 013 คุมอยู่แล้วว่าอ่านได้เฉพาะโฟลเดอร์ตัวเอง
--    แต่ตราบใดที่ bucket ยังเป็น public ลิงก์ตรงก็เปิดได้โดยไม่ผ่าน policy เลย
-- ============================================================
UPDATE storage.buckets SET public = false WHERE id = 'avatars';

-- ============================================================
-- 4. ความยาวคำตอบ
-- ============================================================
UPDATE public.submissions SET answer_text = left(answer_text, 500)
 WHERE char_length(answer_text) > 500;

ALTER TABLE public.submissions
  DROP CONSTRAINT IF EXISTS submissions_answer_length,
  ADD  CONSTRAINT submissions_answer_length CHECK (char_length(answer_text) <= 500);

ALTER TABLE public.final_attempts
  DROP CONSTRAINT IF EXISTS final_attempts_answer_length,
  ADD  CONSTRAINT final_attempts_answer_length CHECK (char_length(answer_text) <= 500);

-- ============================================================
-- 5. กวาดสิทธิ์ EXECUTE
--    Postgres ให้ PUBLIC เรียกฟังก์ชันที่สร้างใหม่ได้เสมอ ถอนทีเดียวแล้วคืนเฉพาะที่ต้องใช้
--    (authenticated มี GRANT ของตัวเองอยู่แล้วทุกตัว จึงไม่กระทบ)
-- ============================================================
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;

-- anon ต้องเรียกได้ตัวเดียว: จำนวนปริศนารายเมืองบนหน้าแรก (ไม่ใช่ความลับ)
GRANT EXECUTE ON FUNCTION public.get_puzzle_totals() TO anon;

-- ฟังก์ชันภายในต้องไม่ถูกเรียกจากภายนอกแม้จะล็อกอินแล้ว
-- (ถูกเรียกจาก trigger หรือจาก RPC ที่เป็น SECURITY DEFINER ซึ่งใช้สิทธิ์ของเจ้าของ)
REVOKE EXECUTE ON FUNCTION
  public.camp_email_role(text),
  public.hash_answer(text),
  public.normalize_answer(text),
  public.handle_new_user(),
  public.prevent_privilege_change(),
  public.stamp_announcement_update(),
  public.recompute_city_progress(smallint),
  public.maybe_auto_unlock(),
  public.pick_random_char(text),
  public.generate_secret_code(),
  public.readiness_check(text, text[])
FROM PUBLIC, anon, authenticated;

-- ============================================================
-- 6. ตรวจว่าปิดครบจริง
--    รันแล้วต้องไม่มีแถวไหนคืนมา — ถ้ามี แปลว่ามีฟังก์ชันหลุดให้ anon เรียกได้
-- ============================================================
DO $check$
DECLARE v_leak text;
BEGIN
  SELECT string_agg(p.proname, ', ') INTO v_leak
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname <> 'get_puzzle_totals'
     AND (has_function_privilege('anon', p.oid, 'EXECUTE')
          OR has_function_privilege('public', p.oid, 'EXECUTE'));

  IF v_leak IS NOT NULL THEN
    RAISE WARNING 'ยังมีฟังก์ชันที่ anon/PUBLIC เรียกได้: %', v_leak;
  ELSE
    RAISE NOTICE 'สิทธิ์ EXECUTE ปิดครบแล้ว';
  END IF;
END;
$check$;
