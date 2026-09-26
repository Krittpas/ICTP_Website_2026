-- ============================================================
-- 020 คาวบอย/คาวเกิร์ล + เลขรุ่น · ยศของพี่ค่าย
--
-- คนใช้เว็บนี้คือ ม.4–6 ทุกคนมีฉายาประจำตัวเป็น "คาวบอย#รุ่น" หรือ "คาวเกิร์ล#รุ่น"
-- เลขรุ่นผูกกับชั้นเรียนแบบตายตัว: รุ่น = 121 − ชั้น ม.
--   ม.6 → 115 · ม.5 → 116 · ม.4 → 117
-- เก็บเป็น "ชั้น ม." ไม่ใช่ "เลขรุ่น" เพราะตรวจค่าผิดได้ง่ายกว่า (4–6 เท่านั้น)
-- และปีหน้าแก้สูตรที่เดียวจบ ไม่ต้องไล่แก้ข้อมูลทุกแถว
--
-- พี่ค่าย (role = 'admin') ไม่ใช้ฉายาคาวบอย แต่มียศของตัวเองสองระดับ
-- นายอำเภอ (sheriff) กับ ผู้พิทักษ์ (guardian) — เลือกได้ในหน้า /admin
--
-- ข้อควรรู้: คำว่า "คาวบอย #1–6" ที่เคยหมายถึงลำดับที่นั่งในเมือง
-- ถูกเปลี่ยนไปเรียกว่า "หมายเลขประจำตัว #1–6" ทั้งเว็บแล้ว (เป็นการแก้ข้อความล้วน ๆ
-- ชื่อคอลัมน์ในฐานข้อมูลยังเป็น seat_index เหมือนเดิม)
--
-- รันต่อจาก 019 ได้เลย · รันซ้ำได้
-- ============================================================

-- ── 1. ชนิดข้อมูล ────────────────────────────────────────────
DO $migrate$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cowhand') THEN
    CREATE TYPE public.cowhand AS ENUM ('cowboy', 'cowgirl');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'deputy_rank') THEN
    CREATE TYPE public.deputy_rank AS ENUM ('sheriff', 'guardian');
  END IF;
END;
$migrate$;

-- ── 2. คอลัมน์ใหม่ ───────────────────────────────────────────
-- ทั้งสามช่องเป็น NULL ได้ = "ยังไม่ได้ตั้ง" หน้าเว็บจะแสดงคำกลาง ๆ แทนฉายา
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cowhand     public.cowhand,
  ADD COLUMN IF NOT EXISTS grade       smallint,
  ADD COLUMN IF NOT EXISTS deputy_rank public.deputy_rank;

DO $migrate$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_grade_range'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_grade_range CHECK (grade IS NULL OR grade BETWEEN 4 AND 6);
  END IF;
END;
$migrate$;

-- ── 3. สิทธิ์อ่าน ────────────────────────────────────────────
-- 018 ถอน SELECT ทั้งตารางแล้วให้กลับมาทีละคอลัมน์ — ของใหม่ต้องต่อท้ายเอง
-- ไม่อย่างนั้นเจ้าตัวอ่านฉายาของตัวเองไม่ได้ (policy ผ่าน แต่ GRANT ไม่ผ่าน)
GRANT SELECT (cowhand, grade, deputy_rank) ON public.profiles TO authenticated;
-- น้องแก้ฉายาตัวเองไม่ได้ เหมือนชื่อ-นามสกุล (014) — ไม่ต้อง REVOKE
-- เพราะ 014 ให้ UPDATE ไว้เฉพาะ (display_name, nickname, avatar_url) อยู่แล้ว

-- ── 4. เลขรุ่นจากชั้นเรียน ────────────────────────────────────
-- สูตรเดียวกับฝั่งเว็บใน src/lib/profile/titles.ts — แก้ที่ไหนต้องแก้อีกที่ด้วย
CREATE OR REPLACE FUNCTION public.camp_generation(p_grade smallint)
RETURNS smallint LANGUAGE sql IMMUTABLE SET search_path = '' AS $fn$
  SELECT CASE WHEN p_grade BETWEEN 4 AND 6 THEN (121 - p_grade)::smallint END;
$fn$;

-- ── 5. พี่ค่ายตั้งชื่อ + ฉายาของน้อง ──────────────────────────
-- แทนที่ของเดิมจาก 014 โดยเพิ่มสองช่อง cowhand / grade
-- ทั้งคู่เป็นช่องเสริม: ไม่ส่งมาหรือส่งค่าว่าง = คงของเดิมไว้ ไม่ล้างทิ้ง
-- แถวไหนผิดแม้แถวเดียว = ไม่บันทึกสักแถว (เหมือนเดิม)
CREATE OR REPLACE FUNCTION public.admin_set_student_names(p_rows jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_uid     uuid := auth.uid();
  v_bad     jsonb;
  v_missing jsonb;
  v_count   integer;
BEGIN
  IF NOT public.is_camp_admin() THEN RETURN jsonb_build_object('status','forbidden'); END IF;
  IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' OR jsonb_array_length(p_rows) = 0 THEN
    RETURN jsonb_build_object('status','empty');
  END IF;

  SELECT jsonb_agg(r->'line') INTO v_bad
    FROM jsonb_array_elements(p_rows) r
   WHERE btrim(coalesce(r->>'name', '')) !~ '^[ก-๛]+( [ก-๛]+)+$'
      OR char_length(btrim(r->>'name')) > 100
      OR btrim(coalesce(r->>'nickname', '')) !~ '^[ก-๛]{1,30}$';
  IF v_bad IS NOT NULL THEN
    RETURN jsonb_build_object('status','invalid_names','rows', v_bad);
  END IF;

  -- ฉายา: ยอมรับแค่ cowboy/cowgirl และชั้น 4–6 เท่านั้น
  SELECT jsonb_agg(r->'line') INTO v_bad
    FROM jsonb_array_elements(p_rows) r
   WHERE coalesce(r->>'cowhand', '') NOT IN ('', 'cowboy', 'cowgirl')
      OR (nullif(btrim(coalesce(r->>'grade', '')), '') IS NOT NULL
          AND btrim(r->>'grade') !~ '^[456]$');
  IF v_bad IS NOT NULL THEN
    RETURN jsonb_build_object('status','invalid_titles','rows', v_bad);
  END IF;

  SELECT jsonb_agg(r->'line') INTO v_missing
    FROM jsonb_array_elements(p_rows) r
   WHERE NOT EXISTS (
     SELECT 1 FROM public.profiles p
      WHERE lower(p.email) = lower(btrim(r->>'email')) AND p.role = 'student');
  IF v_missing IS NOT NULL THEN
    RETURN jsonb_build_object('status','unknown_students','rows', v_missing);
  END IF;

  UPDATE public.profiles p
     SET display_name = btrim(x.r->>'name'),
         nickname     = btrim(x.r->>'nickname'),
         cowhand      = coalesce(nullif(x.r->>'cowhand', '')::public.cowhand, p.cowhand),
         grade        = coalesce(nullif(btrim(coalesce(x.r->>'grade', '')), '')::smallint, p.grade)
    FROM (SELECT DISTINCT ON (lower(btrim(r->>'email'))) r
            FROM jsonb_array_elements(p_rows) WITH ORDINALITY AS t(r, n)
           ORDER BY lower(btrim(r->>'email')), n DESC) x
   WHERE lower(p.email) = lower(btrim(x.r->>'email'));

  GET DIAGNOSTICS v_count = ROW_COUNT;

  INSERT INTO public.admin_audit (actor_id, action, payload)
  VALUES (v_uid, 'set_student_names', jsonb_build_object('count', v_count));

  RETURN jsonb_build_object('status','ok','count', v_count);
END;
$fn$;

-- ── 6. ยศของพี่ค่าย ──────────────────────────────────────────
-- ตั้งได้เฉพาะบัญชีที่เป็น admin อยู่แล้ว — ฟังก์ชันนี้ไม่แจกสิทธิ์ admin ให้ใคร
-- ส่ง p_rank เป็น '' หรือ NULL = ล้างยศกลับไปเป็น "พี่ค่าย" เฉย ๆ
CREATE OR REPLACE FUNCTION public.admin_set_deputy_rank(p_email text, p_rank text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_uid   uuid := auth.uid();
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_rank  text := nullif(btrim(coalesce(p_rank, '')), '');
  v_count integer;
BEGIN
  IF NOT public.is_camp_admin() THEN RETURN jsonb_build_object('status','forbidden'); END IF;
  IF v_rank IS NOT NULL AND v_rank NOT IN ('sheriff', 'guardian') THEN
    RETURN jsonb_build_object('status','invalid_rank');
  END IF;

  UPDATE public.profiles
     SET deputy_rank = v_rank::public.deputy_rank
   WHERE lower(email) = v_email AND role = 'admin';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN RETURN jsonb_build_object('status','admin_not_found'); END IF;

  INSERT INTO public.admin_audit (actor_id, action, payload)
  VALUES (v_uid, 'set_deputy_rank', jsonb_build_object('email', v_email, 'rank', v_rank));

  RETURN jsonb_build_object('status','ok');
END;
$fn$;

-- รายชื่อพี่ค่ายพร้อมยศ — profiles มี policy ให้ admin อ่านได้อยู่แล้ว
-- แต่ทำเป็น RPC เพื่อให้หน้า /admin ดึงครบทุกคอลัมน์ในคำขอเดียวเหมือนแผงอื่น
CREATE OR REPLACE FUNCTION public.admin_list_deputies()
RETURNS TABLE (email text, display_name text, nickname text, deputy_rank text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT p.email, p.display_name, p.nickname, p.deputy_rank::text
    FROM public.profiles p
   WHERE p.role = 'admin' AND public.is_camp_admin()
   ORDER BY p.deputy_rank NULLS LAST, p.display_name, p.email;
$fn$;

-- ── 7. กระดานเมืองแนบฉายามาด้วย ───────────────────────────────
-- แถบลำดับในหน้า /senior/puzzles แสดง "คาวเกิร์ล#116" ใต้ชื่อเพื่อนร่วมเมืองได้
-- คืนเป็นสองช่องดิบ ให้ฝั่งเว็บประกอบข้อความเอง จะได้ไม่มีคำไทยฝังในฐานข้อมูล
--
-- ต้อง DROP ก่อน เพราะ CREATE OR REPLACE เปลี่ยนรูปแบบผลลัพธ์ที่คืนไม่ได้
-- (ของเดิมคืน 4 คอลัมน์ ของใหม่คืน 6) — ไม่มีใครถือ reference ไว้ จึงไม่ต้อง CASCADE
DROP FUNCTION IF EXISTS public.get_city_board(smallint);

CREATE OR REPLACE FUNCTION public.get_city_board(p_city_id smallint)
RETURNS TABLE (seat_index smallint, display_name text, status text, solved_at timestamptz,
               cowhand text, generation smallint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT z.seat_index,
         coalesce(p.display_name, '— ว่าง —'),
         CASE WHEN s.id IS NOT NULL               THEN 'solved'
              WHEN z.seat_index = cp.current_seat THEN 'active'
              ELSE 'locked' END,
         s.solved_at,
         p.cowhand::text,
         public.camp_generation(p.grade)
    FROM public.puzzles z
    JOIN public.city_progress cp ON cp.city_id = z.city_id
    LEFT JOIN public.profiles p  ON p.city_id = z.city_id AND p.seat_index = z.seat_index
    LEFT JOIN public.puzzle_solves s ON s.puzzle_id = z.id
   WHERE z.city_id = p_city_id AND z.is_active
     AND (p_city_id = public.my_city_id() OR public.is_camp_admin())
   ORDER BY z.seat_index;
$fn$;

-- ── 8. สิทธิ์เรียก (ค่าเริ่มต้นของ Postgres ให้ PUBLIC เรียกฟังก์ชันที่เพิ่งสร้าง) ──
REVOKE EXECUTE ON FUNCTION
  public.admin_set_student_names(jsonb),
  public.admin_set_deputy_rank(text, text),
  public.admin_list_deputies(),
  public.get_city_board(smallint),
  public.camp_generation(smallint)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.admin_set_student_names(jsonb),
  public.admin_set_deputy_rank(text, text),
  public.admin_list_deputies(),
  public.get_city_board(smallint),
  public.camp_generation(smallint)
TO authenticated;
