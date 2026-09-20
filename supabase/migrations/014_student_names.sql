-- ============================================================
-- 014 ชื่อ-นามสกุลและชื่อเล่นตั้งโดยพี่ค่ายเท่านั้น (ภาษาไทย)
--
-- 1. น้องแก้ได้แค่รูปโปรไฟล์ของตัวเอง — ถอนสิทธิ์แก้ display_name / nickname ที่ให้ไว้ใน 003
--    ชื่อที่แสดงคือชื่อจริง-นามสกุลภาษาไทย เพื่อนร่วมเมืองเห็นในแถบลำดับคาวบอย
-- 2. admin_set_student_names — พี่ค่ายตั้งชื่อน้องทีละคนหรือวางจากสเปรดชีต
--    ชื่อต้องเป็นอักษรไทย มีอย่างน้อยสองคำ (ชื่อ นามสกุล) · ชื่อเล่นอักษรไทยคำเดียว
-- 3. handle_new_user รับชื่อเล่นจากตอนสร้างบัญชีด้วย (หน้า /admin ส่งมาใน user_metadata)
--
-- รันต่อจาก 013 ได้เลย
-- ============================================================

-- ── 1. สิทธิ์ของน้อง ─────────────────────────────────────────
REVOKE UPDATE (display_name, nickname) ON public.profiles FROM authenticated;
-- avatar_url ยังแก้ได้ (ให้ไว้ใน 003) และถูกจำกัดโฟลเดอร์ด้วย profiles_avatar_own_folder ใน 013

-- ── 2. พี่ค่ายตั้งชื่อน้อง ─────────────────────────────────────
-- รับเป็นก้อน [{line, email, name, nickname}, ...] — แถวไหนผิดแม้แถวเดียว = ไม่บันทึกสักแถว
CREATE OR REPLACE FUNCTION public.admin_set_student_names(p_rows jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
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
         nickname     = btrim(x.r->>'nickname')
    FROM (SELECT DISTINCT ON (lower(btrim(r->>'email'))) r
            FROM jsonb_array_elements(p_rows) WITH ORDINALITY AS t(r, n)
           ORDER BY lower(btrim(r->>'email')), n DESC) x
   WHERE lower(p.email) = lower(btrim(x.r->>'email'));

  GET DIAGNOSTICS v_count = ROW_COUNT;

  INSERT INTO public.admin_audit (actor_id, action, payload)
  VALUES (v_uid, 'set_student_names', jsonb_build_object('count', v_count));

  RETURN jsonb_build_object('status','ok','count', v_count);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_set_student_names(jsonb) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_set_student_names(jsonb) TO authenticated;

-- ── 3. ชื่อเล่นตอนสร้างบัญชี ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_role public.user_role;
  r      public.roster%ROWTYPE;
BEGIN
  v_role := public.camp_email_role(NEW.email);
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'อีเมลนี้ใช้สมัครเข้าค่ายไม่ได้ (ต้องเป็น sXXXXX@bj.ac.th)';
  END IF;

  SELECT * INTO r FROM public.roster WHERE lower(email) = lower(NEW.email);

  INSERT INTO public.profiles (id, email, display_name, nickname, role, student_code, city_id, seat_index)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(r.display_name, NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE(r.nickname, NEW.raw_user_meta_data->>'nickname', ''),
    v_role,
    CASE WHEN v_role = 'student' THEN split_part(NEW.email, '@', 1) END,
    r.city_id,
    r.seat_index
  );

  UPDATE public.roster SET account_created_at = now() WHERE lower(email) = lower(NEW.email);
  RETURN NEW;
END;
$$;
