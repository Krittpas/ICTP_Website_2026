-- ============================================================
-- 008 ปิดช่องโหว่ก่อนวันงาน + ตั้งด่านสุดท้ายผ่านเว็บ
--
-- 1. ด่านสุดท้ายเดาได้ไม่จำกัด
--    check_final_cipher ไม่มี rate limit เลย น้อง 36 คนยิงเดาได้ไม่รู้จบ
--    ตอนนี้ตอบผิดได้ 5 ครั้งใน 10 นาทีต่อคน เหมือนปริศนาเมือง
--    และบันทึกทุกครั้งลง final_attempts
-- 2. สิทธิ์เรียกฟังก์ชันกว้างเกินไป
--    Postgres ให้ EXECUTE กับ PUBLIC เป็นค่าเริ่มต้น และ Supabase ให้ anon ด้วย
--    REVOKE ใน 003 ถอนแค่จาก anon/authenticated จึงยังเรียกผ่าน PUBLIC ได้
--    ผลคือใครก็เรียก camp_email_role('x@bj.ac.th') เพื่อเดาว่าอีเมลไหนเป็นพี่ค่ายได้
--    ตอนนี้ anon เรียกได้แค่ get_puzzle_totals และฟังก์ชันภายในเรียกจากภายนอกไม่ได้
--    (trigger ไม่ตรวจสิทธิ์ EXECUTE ตอนทำงาน และฟังก์ชัน SECURITY DEFINER
--     เรียกฟังก์ชันภายในด้วยสิทธิ์ของเจ้าของ จึงไม่กระทบตรรกะเดิม)
-- 3. get_city_board ดูกระดานเมืองไหนก็ได้ ข้าม RLS ของ profiles
--    ตอนนี้ดูได้เฉพาะเมืองของตัวเอง ยกเว้นพี่ค่าย
-- 4. ด่านสุดท้ายแก้ได้แค่ผ่าน SQL
--    เพิ่ม admin_get_final_cipher / admin_set_final_cipher ให้หน้า /admin ใช้
--
-- รันต่อจาก 007 ได้เลย
-- ============================================================

-- ── 1. บันทึกการตอบด่านสุดท้าย (rate limit + audit) ──────────
CREATE TABLE IF NOT EXISTS public.final_attempts (
  id           bigserial   PRIMARY KEY,
  user_id      uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  answer_text  text        NOT NULL,
  is_correct   boolean     NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_final_attempts_rate_limit
  ON public.final_attempts (user_id, submitted_at);

-- ไม่มี policy โดยตั้งใจ — เข้าถึงผ่าน RPC เท่านั้น
ALTER TABLE public.final_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.final_attempts FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.check_final_cipher(p_answer text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_sec      public.camp_secrets%ROWTYPE;
  v_attempts integer;
  v_ok       boolean;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('status','unauthorized'); END IF;
  IF NOT (SELECT decrypt_unlocked FROM public.camp_state WHERE id = 1) THEN
    RETURN jsonb_build_object('status','locked');
  END IF;

  SELECT * INTO v_sec FROM public.camp_secrets WHERE id = 1;
  IF v_sec.final_hash IS NULL THEN RETURN jsonb_build_object('status','not_ready'); END IF;

  -- ล็อกรายคน กันกดรัว ๆ พร้อมกันแล้วหลุดเกิน 5 ครั้ง
  PERFORM pg_advisory_xact_lock(hashtextextended('final_cipher:' || v_uid::text, 0));

  SELECT count(*) INTO v_attempts FROM public.final_attempts
   WHERE user_id = v_uid AND NOT is_correct
     AND submitted_at > now() - interval '10 minutes';
  IF v_attempts >= 5 THEN
    RETURN jsonb_build_object('status','rate_limited');
  END IF;

  v_ok := public.hash_answer(p_answer) = v_sec.final_hash;

  INSERT INTO public.final_attempts (user_id, answer_text, is_correct)
  VALUES (v_uid, left(coalesce(p_answer, ''), 500), v_ok);

  IF v_ok THEN
    RETURN jsonb_build_object('status','correct','reward',v_sec.final_reward);
  END IF;
  RETURN jsonb_build_object('status','incorrect','attempts_left', 4 - v_attempts);
END;
$$;

-- ── 3. กระดานเมือง — เฉพาะเมืองของตัวเอง ──────────────────────
CREATE OR REPLACE FUNCTION public.get_city_board(p_city_id smallint)
RETURNS TABLE (seat_index smallint, display_name text, status text, solved_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT z.seat_index,
         coalesce(p.display_name, '— ว่าง —'),
         CASE WHEN s.id IS NOT NULL               THEN 'solved'
              WHEN z.seat_index = cp.current_seat THEN 'active'
              ELSE 'locked' END,
         s.solved_at
    FROM public.puzzles z
    JOIN public.city_progress cp ON cp.city_id = z.city_id
    LEFT JOIN public.profiles p  ON p.city_id = z.city_id AND p.seat_index = z.seat_index
    LEFT JOIN public.puzzle_solves s ON s.puzzle_id = z.id
   WHERE z.city_id = p_city_id AND z.is_active
     AND (p_city_id = public.my_city_id() OR public.is_camp_admin())
   ORDER BY z.seat_index;
$$;

-- ── 4. ด่านสุดท้าย: พี่ค่ายอ่าน/ตั้งผ่านเว็บ ────────────────────
-- เฉลยไม่ถูกส่งกลับ บอกแค่ว่าตั้งไว้แล้วหรือยัง
CREATE OR REPLACE FUNCTION public.admin_get_final_cipher()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_sec public.camp_secrets%ROWTYPE;
BEGIN
  IF NOT public.is_camp_admin() THEN RETURN jsonb_build_object('status','forbidden'); END IF;
  SELECT * INTO v_sec FROM public.camp_secrets WHERE id = 1;
  RETURN jsonb_build_object('status','ok',
    'prompt', v_sec.final_prompt,
    'reward', v_sec.final_reward,
    'has_answer', v_sec.final_hash IS NOT NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_final_cipher(p_prompt text, p_answer text, p_reward text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_changed boolean := coalesce(btrim(p_answer), '') <> '';
BEGIN
  IF NOT public.is_camp_admin() THEN RETURN jsonb_build_object('status','forbidden'); END IF;
  IF coalesce(btrim(p_prompt), '') = '' THEN
    RETURN jsonb_build_object('status','prompt_required');
  END IF;

  UPDATE public.camp_secrets
     SET final_prompt = btrim(p_prompt),
         final_reward = coalesce(btrim(p_reward), ''),
         -- ส่งคำตอบว่างมา = ไม่เปลี่ยนเฉลยเดิม
         final_hash   = CASE WHEN v_changed THEN public.hash_answer(p_answer) ELSE final_hash END
   WHERE id = 1;

  INSERT INTO public.admin_audit (actor_id, action, payload)
  VALUES (v_uid, 'set_final_cipher', jsonb_build_object('answer_changed', v_changed));

  RETURN jsonb_build_object('status','ok');
END;
$$;

-- ── 2. สิทธิ์เรียกฟังก์ชัน ────────────────────────────────────
-- ต้องอยู่หลังการสร้างฟังก์ชันทั้งหมดในไฟล์นี้ เพื่อให้ครอบคลุมตัวใหม่ด้วย
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_puzzle_totals() TO anon;

-- ฟังก์ชันภายใน — ถูกเรียกจาก trigger หรือจาก RPC ที่เป็น SECURITY DEFINER เท่านั้น
-- is_camp_admin / my_city_id ยังต้องให้ authenticated เพราะ RLS policy เรียกใช้
REVOKE EXECUTE ON FUNCTION
  public.camp_email_role(text),
  public.hash_answer(text),
  public.normalize_answer(text),
  public.handle_new_user(),
  public.prevent_privilege_change(),
  public.stamp_announcement_update(),
  public.recompute_city_progress(smallint),
  public.maybe_auto_unlock()
FROM authenticated;

GRANT EXECUTE ON FUNCTION
  public.check_final_cipher(text),
  public.admin_get_final_cipher(),
  public.admin_set_final_cipher(text, text, text)
TO authenticated;
