-- ============================================================
-- 010 เครื่องถอดรหัสแบบรายคน — ตรงตามเนื้อเรื่อง "The Secrets of ICTP Valley"
--
-- เดิม: ด่านสุดท้ายมีคำตอบเดียวร่วมกันทั้งค่าย ทุกคนได้ข้อความรางวัลเดียวกัน
-- ใหม่: น้องแต่ละคนนำ "รหัสลับประจำตัว" ของตัวเองมาใส่เครื่อง
--       แล้วเครื่องเผยตัวตนพี่รหัสของคนนั้นคนเดียว
--
-- 1. senior_matches — ใครเป็นพี่รหัสของใคร ผูกด้วยอีเมลนักเรียน
--    จึงเตรียมไว้ก่อนสร้างบัญชีได้ และไม่หลุดถ้าต้องลบบัญชีสร้างใหม่
--    ไม่มี policy ใด ๆ — อ่านได้ผ่าน RPC เท่านั้น
-- 2. get_my_senior / reveal_my_senior — ฝั่งน้อง
--    ต้องเปิดประตูแล้ว · ต้องผ่านปริศนาของตัวเองแล้ว · รหัสต้องเป็นของตัวเอง
--    ตอบผิดได้ 5 ครั้งใน 10 นาที ใช้ตาราง final_attempts เดิมนับ
-- 3. admin_list / admin_upsert / admin_delete senior matches — ฝั่งพี่ค่าย
--
-- ฟังก์ชันด่านสุดท้ายแบบเดิม (get_final_cipher, check_final_cipher ฯลฯ) ไม่ถูกลบ
-- แต่หน้าเว็บไม่เรียกใช้แล้ว
--
-- รันต่อจาก 009 ได้เลย
-- ============================================================

-- ── 1. ตารางจับคู่พี่รหัส ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.senior_matches (
  student_email   text        PRIMARY KEY CHECK (student_email = lower(student_email)),
  senior_name     text        NOT NULL CHECK (char_length(senior_name) BETWEEN 1 AND 100),
  senior_nickname text        NOT NULL DEFAULT '' CHECK (char_length(senior_nickname) <= 50),
  clue            text        NOT NULL DEFAULT '' CHECK (char_length(clue) <= 1000),
  revealed_at     timestamptz,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.senior_matches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.senior_matches FROM anon, authenticated;

-- ── 2. ฝั่งน้อง ───────────────────────────────────────────────
-- ใช้ตอนเปิดหน้า: เคยเปิดเผยแล้ว = แสดงซ้ำได้เลยโดยไม่ต้องใส่รหัสใหม่
CREATE OR REPLACE FUNCTION public.get_my_senior()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_prof     public.profiles%ROWTYPE;
  v_match    public.senior_matches%ROWTYPE;
  v_unlocked boolean;
BEGIN
  SELECT * INTO v_prof FROM public.profiles WHERE id = auth.uid();
  IF v_prof.id IS NULL THEN RETURN jsonb_build_object('status','unauthorized'); END IF;

  SELECT decrypt_unlocked INTO v_unlocked FROM public.camp_state WHERE id = 1;
  IF NOT coalesce(v_unlocked, false) THEN RETURN jsonb_build_object('status','locked'); END IF;

  IF v_prof.role = 'admin' THEN RETURN jsonb_build_object('status','admin'); END IF;

  SELECT * INTO v_match FROM public.senior_matches WHERE student_email = lower(v_prof.email);
  IF v_match.revealed_at IS NOT NULL THEN
    RETURN jsonb_build_object('status','revealed',
      'senior_name', v_match.senior_name,
      'senior_nickname', v_match.senior_nickname,
      'clue', v_match.clue);
  END IF;

  RETURN jsonb_build_object('status','ready');
END;
$$;

CREATE OR REPLACE FUNCTION public.reveal_my_senior(p_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_prof     public.profiles%ROWTYPE;
  v_puz      public.puzzles%ROWTYPE;
  v_match    public.senior_matches%ROWTYPE;
  v_attempts integer;
  v_ok       boolean;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('status','unauthorized'); END IF;
  IF NOT (SELECT decrypt_unlocked FROM public.camp_state WHERE id = 1) THEN
    RETURN jsonb_build_object('status','locked');
  END IF;

  SELECT * INTO v_prof FROM public.profiles WHERE id = v_uid;
  IF v_prof.role = 'admin' THEN RETURN jsonb_build_object('status','admin'); END IF;
  IF v_prof.city_id IS NULL OR v_prof.seat_index IS NULL THEN
    RETURN jsonb_build_object('status','unassigned');
  END IF;

  -- ล็อกรายคน กันกดรัว ๆ พร้อมกันแล้วหลุดเกิน 5 ครั้ง
  PERFORM pg_advisory_xact_lock(hashtextextended('decrypt:' || v_uid::text, 0));

  SELECT count(*) INTO v_attempts FROM public.final_attempts
   WHERE user_id = v_uid AND NOT is_correct
     AND submitted_at > now() - interval '10 minutes';
  IF v_attempts >= 5 THEN RETURN jsonb_build_object('status','rate_limited'); END IF;

  -- รหัสลับได้มาจากการผ่านปริศนาของตัวเองเท่านั้น (ตอบเองหรือพี่ค่ายปลดให้)
  SELECT * INTO v_puz FROM public.puzzles
   WHERE city_id = v_prof.city_id AND seat_index = v_prof.seat_index;
  IF v_puz.id IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.puzzle_solves WHERE puzzle_id = v_puz.id) THEN
    RETURN jsonb_build_object('status','not_solved');
  END IF;

  -- เทียบแบบเดียวกับคำตอบปริศนา — ไม่สนตัวพิมพ์เล็กใหญ่และช่องว่างหัวท้าย
  v_ok := public.normalize_answer(p_code) = public.normalize_answer(v_puz.secret_code);

  INSERT INTO public.final_attempts (user_id, answer_text, is_correct)
  VALUES (v_uid, left(coalesce(p_code, ''), 500), v_ok);

  IF NOT v_ok THEN
    RETURN jsonb_build_object('status','incorrect','attempts_left', 4 - v_attempts);
  END IF;

  SELECT * INTO v_match FROM public.senior_matches WHERE student_email = lower(v_prof.email);
  IF v_match.student_email IS NULL THEN RETURN jsonb_build_object('status','no_match'); END IF;

  UPDATE public.senior_matches
     SET revealed_at = coalesce(revealed_at, now())
   WHERE student_email = v_match.student_email;

  RETURN jsonb_build_object('status','revealed',
    'senior_name', v_match.senior_name,
    'senior_nickname', v_match.senior_nickname,
    'clue', v_match.clue);
END;
$$;

-- ── 3. ฝั่งพี่ค่าย ────────────────────────────────────────────
-- น้องทุกคนในระบบ + คู่ที่ตั้งไว้แล้ว รวมถึงคู่ที่อีเมลยังไม่มีบัญชี (ช่วยจับอีเมลพิมพ์ผิด)
CREATE OR REPLACE FUNCTION public.admin_list_senior_matches()
RETURNS TABLE (
  email text, display_name text, city_id smallint, seat_index smallint, has_account boolean,
  senior_name text, senior_nickname text, clue text, revealed_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.is_camp_admin() THEN RETURN; END IF;

  RETURN QUERY
  SELECT coalesce(lower(p.email), m.student_email),
         coalesce(p.display_name, ''),
         p.city_id, p.seat_index,
         p.id IS NOT NULL,
         m.senior_name, m.senior_nickname, m.clue, m.revealed_at
    FROM (SELECT * FROM public.profiles WHERE role = 'student') p
    FULL JOIN public.senior_matches m ON m.student_email = lower(p.email)
   ORDER BY p.city_id NULLS LAST, p.seat_index NULLS LAST, 1;
END;
$$;

-- รับเป็นก้อน [{line, email, name, nickname, clue}, ...] — ใช้ทั้งฟอร์มทีละคนและวางจากสเปรดชีต
-- แถวไหนผิดแม้แถวเดียว = ไม่บันทึกเลยสักแถว แล้วบอกเลขบรรทัดที่ผิดกลับไป
CREATE OR REPLACE FUNCTION public.admin_upsert_senior_matches(p_rows jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_bad   jsonb;
  v_count integer;
BEGIN
  IF NOT public.is_camp_admin() THEN RETURN jsonb_build_object('status','forbidden'); END IF;
  IF jsonb_typeof(p_rows) IS DISTINCT FROM 'array' OR jsonb_array_length(p_rows) = 0 THEN
    RETURN jsonb_build_object('status','empty');
  END IF;

  SELECT jsonb_agg(r->'line') INTO v_bad
    FROM jsonb_array_elements(p_rows) r
   WHERE lower(btrim(coalesce(r->>'email', ''))) !~ '^s[0-9]{5}@bj\.ac\.th$'
      OR char_length(btrim(coalesce(r->>'name', ''))) NOT BETWEEN 1 AND 100
      OR char_length(btrim(coalesce(r->>'nickname', ''))) > 50
      OR char_length(btrim(coalesce(r->>'clue', ''))) > 1000;
  IF v_bad IS NOT NULL THEN
    RETURN jsonb_build_object('status','invalid_rows','rows', v_bad);
  END IF;

  -- อีเมลซ้ำในก้อนเดียว เอาแถวหลังสุด
  INSERT INTO public.senior_matches (student_email, senior_name, senior_nickname, clue)
  SELECT DISTINCT ON (lower(btrim(r->>'email')))
         lower(btrim(r->>'email')), btrim(r->>'name'),
         btrim(coalesce(r->>'nickname', '')), btrim(coalesce(r->>'clue', ''))
    FROM jsonb_array_elements(p_rows) WITH ORDINALITY AS t(r, n)
   ORDER BY lower(btrim(r->>'email')), n DESC
  ON CONFLICT (student_email) DO UPDATE
    SET senior_name     = EXCLUDED.senior_name,
        senior_nickname = EXCLUDED.senior_nickname,
        clue            = EXCLUDED.clue,
        updated_at      = now();

  GET DIAGNOSTICS v_count = ROW_COUNT;

  INSERT INTO public.admin_audit (actor_id, action, payload)
  VALUES (v_uid, 'upsert_senior_matches', jsonb_build_object('count', v_count));

  RETURN jsonb_build_object('status','ok','count', v_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_senior_match(p_email text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF NOT public.is_camp_admin() THEN RETURN jsonb_build_object('status','forbidden'); END IF;

  DELETE FROM public.senior_matches WHERE student_email = lower(btrim(p_email));
  IF NOT FOUND THEN RETURN jsonb_build_object('status','match_not_found'); END IF;

  INSERT INTO public.admin_audit (actor_id, action, payload)
  VALUES (v_uid, 'delete_senior_match', jsonb_build_object('email', lower(btrim(p_email))));

  RETURN jsonb_build_object('status','ok');
END;
$$;

-- ── สิทธิ์ — ค่าเริ่มต้นของ Postgres/Supabase ให้ PUBLIC และ anon เรียกได้ ต้องถอนเอง ──
REVOKE EXECUTE ON FUNCTION
  public.get_my_senior(),
  public.reveal_my_senior(text),
  public.admin_list_senior_matches(),
  public.admin_upsert_senior_matches(jsonb),
  public.admin_delete_senior_match(text)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.get_my_senior(),
  public.reveal_my_senior(text),
  public.admin_list_senior_matches(),
  public.admin_upsert_senior_matches(jsonb),
  public.admin_delete_senior_match(text)
TO authenticated;
