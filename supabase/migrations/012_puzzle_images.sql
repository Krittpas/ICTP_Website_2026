-- ============================================================
-- 012 ปริศนาเป็นรูปภาพ + คำใบ้ใต้รูป
--
-- 1. ที่เก็บไฟล์ "puzzles" — ส่วนตัว ไม่มีลิงก์สาธารณะ
--    หลักเดิมของระบบคือโจทย์ไม่เคยออกจากฐานข้อมูลก่อนถึงตา รูปโจทย์ก็ต้องเป็นแบบเดียวกัน
--    ใครดูรูปไหนได้ ตัดสินด้วย policy ของ Storage ที่ถามฐานข้อมูลทุกครั้ง:
--      พี่ค่าย = ทุกรูป · น้อง = เฉพาะรูปของที่นั่งตัวเอง เมื่อถึงตา (ค่ายเปิดแล้ว) หรือผ่านแล้ว
--    หน้าเว็บขอลิงก์ชั่วคราว (signed URL) ด้วยสิทธิ์ของน้องเอง ไม่ใช้ service role
-- 2. admin_upsert_puzzle รับรูปได้ (p_media_url) และคืน path รูปเก่าที่ถูกแทนที่ ให้ลบทิ้ง
-- 3. admin_get_puzzle — ดึงปริศนาเดิมมาแก้ต่อ
--    ฟอร์มเดิมว่างเสมอ แก้แค่คำใบ้ก็ต้องกรอกทุกช่องใหม่ ไม่อย่างนั้นโจทย์เดิมถูกทับด้วยค่าว่าง
--    เฉลยยังไม่ถูกส่งกลับ บอกแค่ว่าตั้งไว้แล้วหรือยัง
--
-- puzzles.media_url มีอยู่แล้วตั้งแต่ 001 ตอนนี้ใช้เก็บ path ใน Storage (<uuid>/file.<นามสกุล>)
--
-- รันต่อจาก 011 ได้เลย
-- ============================================================

-- ── 1. ที่เก็บไฟล์ ────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('puzzles', 'puzzles', false, 10485760,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO UPDATE
  SET public             = false,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- path รูปโจทย์ที่ผู้เรียกมีสิทธิ์เห็นตอนนี้ (หรือ NULL) — ตรรกะเดียวกับ get_my_puzzle
CREATE OR REPLACE FUNCTION public.my_puzzle_media_path()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT z.media_url
    FROM public.profiles p
    JOIN public.puzzles z        ON z.city_id = p.city_id AND z.seat_index = p.seat_index AND z.is_active
    JOIN public.city_progress cp ON cp.city_id = z.city_id
   WHERE p.id = auth.uid()
     AND z.media_url IS NOT NULL
     AND (
       EXISTS (SELECT 1 FROM public.puzzle_solves s WHERE s.puzzle_id = z.id)
       OR ((SELECT camp_open FROM public.camp_state WHERE id = 1) AND cp.current_seat = z.seat_index)
     );
$$;

REVOKE EXECUTE ON FUNCTION public.my_puzzle_media_path() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.my_puzzle_media_path() TO authenticated;

DROP POLICY IF EXISTS "read own puzzle image"   ON storage.objects;
DROP POLICY IF EXISTS "admin upload puzzle image" ON storage.objects;
DROP POLICY IF EXISTS "admin delete puzzle image" ON storage.objects;

-- การขอ signed URL ต้องผ่าน SELECT policy นี้
CREATE POLICY "read own puzzle image" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'puzzles' AND (public.is_camp_admin() OR name = public.my_puzzle_media_path()));

CREATE POLICY "admin upload puzzle image" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'puzzles' AND public.is_camp_admin());

CREATE POLICY "admin delete puzzle image" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'puzzles' AND public.is_camp_admin());

-- ── 2. บันทึกปริศนา ──────────────────────────────────────────
-- เปลี่ยนจำนวนพารามิเตอร์ = ต้องลบตัวเดิมก่อน ไม่อย่างนั้นได้สองตัวซ้อนกัน
DROP FUNCTION IF EXISTS public.admin_upsert_puzzle(smallint, smallint, text, text, text, text, text);

-- p_media_url: NULL = ไม่เปลี่ยนรูปเดิม · '' = เอารูปออก · path = ใช้รูปนี้
CREATE OR REPLACE FUNCTION public.admin_upsert_puzzle(
  p_city_id smallint, p_seat_index smallint,
  p_title text, p_prompt text, p_hint text,
  p_answer text, p_secret_code text,
  p_media_url text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_no_answer boolean := coalesce(btrim(p_answer), '') = '';
  v_old_media text;
  v_media     text;
BEGIN
  IF NOT public.is_camp_admin() THEN RETURN jsonb_build_object('status','forbidden'); END IF;

  IF p_media_url IS NOT NULL AND p_media_url <> ''
     AND p_media_url !~ '^[0-9a-f-]{36}/file(\.[a-z0-9]{1,8})?$' THEN
    RETURN jsonb_build_object('status','invalid_media');
  END IF;

  -- ล็อกแถวเมืองก่อน กันน้องตอบถูกพร้อมกับตอนที่โซ่กำลังถูกคำนวณใหม่
  PERFORM 1 FROM public.city_progress WHERE city_id = p_city_id FOR UPDATE;

  SELECT media_url INTO v_old_media FROM public.puzzles
   WHERE city_id = p_city_id AND seat_index = p_seat_index;

  IF NOT FOUND AND v_no_answer THEN
    RETURN jsonb_build_object('status','answer_required');
  END IF;

  v_media := CASE WHEN p_media_url IS NULL THEN v_old_media
                  ELSE nullif(p_media_url, '') END;

  INSERT INTO public.puzzles (city_id, seat_index, title, prompt, hint, media_url, answer_hash, secret_code)
  VALUES (p_city_id, p_seat_index, p_title, coalesce(p_prompt, ''), coalesce(p_hint, ''), v_media,
          public.hash_answer(p_answer), p_secret_code)
  ON CONFLICT (city_id, seat_index) DO UPDATE
    SET title       = EXCLUDED.title,
        prompt      = EXCLUDED.prompt,
        hint        = EXCLUDED.hint,
        media_url   = EXCLUDED.media_url,
        -- ส่งคำตอบว่างมา = ไม่เปลี่ยนเฉลยเดิม
        answer_hash = CASE WHEN v_no_answer
                           THEN public.puzzles.answer_hash ELSE EXCLUDED.answer_hash END,
        secret_code = EXCLUDED.secret_code;

  PERFORM public.recompute_city_progress(p_city_id);

  INSERT INTO public.admin_audit (actor_id, action, payload)
  VALUES (v_uid, 'upsert_puzzle',
          jsonb_build_object('city_id', p_city_id, 'seat_index', p_seat_index,
                             'answer_changed', NOT v_no_answer,
                             'media_changed', v_media IS DISTINCT FROM v_old_media));

  -- รูปเก่าที่ไม่ถูกใช้แล้ว ให้หน้าเว็บลบออกจาก Storage
  RETURN jsonb_build_object('status','ok',
    'replaced_media', CASE WHEN v_old_media IS DISTINCT FROM v_media THEN v_old_media END);
END;
$$;

-- ── 3. ดึงปริศนาเดิมมาแก้ ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_get_puzzle(p_city_id smallint, p_seat_index smallint)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_puz public.puzzles%ROWTYPE;
BEGIN
  IF NOT public.is_camp_admin() THEN RETURN jsonb_build_object('status','forbidden'); END IF;

  SELECT * INTO v_puz FROM public.puzzles WHERE city_id = p_city_id AND seat_index = p_seat_index;
  IF v_puz.id IS NULL THEN RETURN jsonb_build_object('status','not_found'); END IF;

  RETURN jsonb_build_object('status','ok',
    'title', v_puz.title,
    'prompt', v_puz.prompt,
    'hint', v_puz.hint,
    'media_url', v_puz.media_url,
    'secret_code', v_puz.secret_code,
    'is_solved', EXISTS (SELECT 1 FROM public.puzzle_solves WHERE puzzle_id = v_puz.id));
END;
$$;

REVOKE EXECUTE ON FUNCTION
  public.admin_upsert_puzzle(smallint, smallint, text, text, text, text, text, text),
  public.admin_get_puzzle(smallint, smallint)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.admin_upsert_puzzle(smallint, smallint, text, text, text, text, text, text),
  public.admin_get_puzzle(smallint, smallint)
TO authenticated;
