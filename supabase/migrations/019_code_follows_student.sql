-- ============================================================
-- 019 รหัสลับติดตัวคน ไม่ใช่ติดที่นั่ง
--
-- ปัญหาเดิม: get_my_puzzle() และ reveal_my_senior() อ้าง "ที่นั่งปัจจุบัน" เสมอ
-- น้องจึงเสียสิทธิ์ทุกอย่างทันทีที่พี่ค่ายขยับที่นั่งให้ ทั้งที่ไม่ได้ทำอะไรผิด
--
--   1. ย้ายน้องออกจากที่นั่งที่ตัวเองไขผ่านแล้ว
--      รหัสลับที่จดไว้ใช้กับเครื่องถอดรหัสไม่ได้อีก เพราะระบบไปดูที่นั่งใหม่ซึ่งยังไม่มีใครไข
--      หน้าเว็บก็ไม่แสดงรหัสเดิมให้ดูซ้ำด้วย = หายไปเฉย ๆ
--
--   2. ปิดที่นั่งที่มีคนนั่งอยู่
--      get_my_puzzle() กรอง is_active ทิ้ง จึงคืน no_puzzle
--      น้องเห็นข้อความ "รอพี่ค่ายจัดเมืองและใส่โจทย์" ซึ่งไม่ใช่เรื่องจริงเลย
--      และถอดรหัสไม่ได้ตลอดไปโดยไม่มีใครรู้
--
-- ตอนนี้:
--   · รหัสที่ "ตัวเองไขผ่าน" ใช้ได้ตลอด ไม่ว่าจะถูกย้ายไปนั่งที่ไหน
--   · รหัสของที่นั่งปัจจุบันที่ถูกไขผ่านแล้วก็ใช้ได้ (คือรหัสที่หน้าเว็บแสดงให้เขาเห็น)
--     หลักคือ "รหัสไหนที่ระบบเคยแสดงให้คุณดู รหัสนั้นใช้ได้"
--   · ที่นั่งที่ถูกปิดมีสถานะของตัวเอง หน้าเว็บจะได้บอกความจริง
--   · ทุกสถานะแนบ earned_code มาด้วย น้องเปิดดูรหัสที่ได้มาแล้วซ้ำได้เสมอ
--
-- รันต่อจาก 018 ได้เลย
-- ============================================================

-- ── โจทย์ของฉัน ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_puzzle()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_prof   public.profiles%ROWTYPE;
  v_seat   public.puzzles%ROWTYPE;   -- ปริศนาของที่นั่งนี้ ไม่ว่าจะเปิดหรือปิดอยู่
  v_cur    smallint;
  v_done   boolean;
  v_open   boolean;
  v_earned text;
  v_waiting text;
BEGIN
  SELECT * INTO v_prof FROM public.profiles WHERE id = auth.uid();
  IF v_prof.id IS NULL THEN RETURN jsonb_build_object('status', 'unauthorized'); END IF;
  IF v_prof.city_id IS NULL OR v_prof.seat_index IS NULL THEN
    RETURN jsonb_build_object('status', 'unassigned');
  END IF;

  -- รหัสที่เจ้าตัวไขผ่านมาแล้ว — ติดตัวไป ไม่ขึ้นกับว่าตอนนี้นั่งที่ไหน
  SELECT z.secret_code INTO v_earned
    FROM public.puzzle_solves s
    JOIN public.puzzles z ON z.id = s.puzzle_id
   WHERE s.user_id = v_prof.id
   ORDER BY s.solved_at DESC
   LIMIT 1;

  -- ไม่กรอง is_active ตรงนี้ เพื่อให้แยกออกว่า "ไม่มีปริศนา" กับ "ปริศนาถูกปิด" ต่างกัน
  SELECT * INTO v_seat FROM public.puzzles
   WHERE city_id = v_prof.city_id AND seat_index = v_prof.seat_index;

  IF v_seat.id IS NULL THEN
    RETURN jsonb_build_object('status','no_puzzle','earned_code', v_earned);
  END IF;

  IF NOT v_seat.is_active THEN
    RETURN jsonb_build_object('status','seat_closed',
      'seat_index', v_prof.seat_index, 'earned_code', v_earned);
  END IF;

  SELECT current_seat INTO v_cur  FROM public.city_progress WHERE city_id = v_prof.city_id;
  SELECT camp_open    INTO v_open FROM public.camp_state    WHERE id = 1;
  SELECT EXISTS (SELECT 1 FROM public.puzzle_solves WHERE puzzle_id = v_seat.id) INTO v_done;

  IF v_done THEN
    RETURN jsonb_build_object('status','solved','title',v_seat.title,
      'prompt',v_seat.prompt,'secret_code',v_seat.secret_code,'seat_index',v_prof.seat_index,
      'earned_code', v_earned);
  ELSIF NOT coalesce(v_open, false) THEN
    RETURN jsonb_build_object('status','camp_closed','seat_index',v_prof.seat_index,
      'earned_code', v_earned);
  ELSIF v_cur = v_prof.seat_index THEN
    RETURN jsonb_build_object('status','active','puzzle_id',v_seat.id,'title',v_seat.title,
      'prompt',v_seat.prompt,'hint',v_seat.hint,'media_url',v_seat.media_url,
      'seat_index',v_prof.seat_index,
      'earned_code', v_earned,
      'attempts_left', 5 - (SELECT count(*) FROM public.submissions
                             WHERE user_id = v_prof.id AND puzzle_id = v_seat.id
                               AND submitted_at > now() - interval '10 minutes'));
  ELSE
    SELECT display_name INTO v_waiting FROM public.profiles
     WHERE city_id = v_prof.city_id AND seat_index = v_cur;
    RETURN jsonb_build_object('status','locked','current_seat',v_cur,
      'seat_index',v_prof.seat_index,'waiting_on',coalesce(v_waiting,''),
      'earned_code', v_earned);
  END IF;
END;
$fn$;

-- ── เครื่องถอดรหัส ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reveal_my_senior(p_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_uid      uuid := auth.uid();
  v_prof     public.profiles%ROWTYPE;
  v_senior   public.seniors%ROWTYPE;
  v_attempts integer;
  v_has_code boolean;
  v_ok       boolean;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('status','unauthorized'); END IF;
  IF NOT (SELECT decrypt_unlocked FROM public.camp_state WHERE id = 1) THEN
    RETURN jsonb_build_object('status','locked');
  END IF;

  SELECT * INTO v_prof FROM public.profiles WHERE id = v_uid;
  IF v_prof.role = 'admin' THEN RETURN jsonb_build_object('status','admin'); END IF;

  -- ล็อกรายคน กันกดรัว ๆ พร้อมกันแล้วหลุดเกิน 5 ครั้ง
  PERFORM pg_advisory_xact_lock(hashtextextended('decrypt:' || v_uid::text, 0));

  SELECT count(*) INTO v_attempts FROM public.final_attempts
   WHERE user_id = v_uid AND NOT is_correct
     AND submitted_at > now() - interval '10 minutes';
  IF v_attempts >= 5 THEN RETURN jsonb_build_object('status','rate_limited'); END IF;

  /*
   * รหัสที่ยอมรับ = รหัสที่ระบบเคยแสดงให้คนนี้เห็น ซึ่งมีสองทาง
   *   1. ปริศนาที่เจ้าตัวไขผ่านเอง (หรือพี่ค่ายปลดให้ ซึ่งบันทึกเจ้าของที่นั่งเป็นผู้ไข)
   *      ทางนี้ติดตัวไป ย้ายที่นั่งกี่ครั้งก็ยังใช้ได้
   *   2. ปริศนาของที่นั่งที่ตัวเองนั่งอยู่ตอนนี้ ถ้ามีคนไขผ่านไปแล้ว
   *      เพราะหน้าเว็บแสดงรหัสนั้นให้เขาดูอยู่ (เช่นถูกย้ายมานั่งที่นั่งที่ผ่านแล้ว)
   */
  SELECT count(*) > 0,
         coalesce(bool_or(public.normalize_answer(z.secret_code)
                          = public.normalize_answer(p_code)), false)
    INTO v_has_code, v_ok
    FROM public.puzzles z
   WHERE EXISTS (SELECT 1 FROM public.puzzle_solves s
                  WHERE s.puzzle_id = z.id AND s.user_id = v_uid)
      OR (z.city_id    = v_prof.city_id
      AND z.seat_index = v_prof.seat_index
      AND EXISTS (SELECT 1 FROM public.puzzle_solves s WHERE s.puzzle_id = z.id));

  IF NOT coalesce(v_has_code, false) THEN
    -- ไม่เคยไขอะไรผ่านเลย และยังไม่มีที่นั่งด้วย = คนละสาเหตุกัน บอกให้ตรงเรื่อง
    IF v_prof.city_id IS NULL OR v_prof.seat_index IS NULL THEN
      RETURN jsonb_build_object('status','unassigned');
    END IF;
    RETURN jsonb_build_object('status','not_solved');
  END IF;

  v_ok := coalesce(v_ok, false);

  INSERT INTO public.final_attempts (user_id, answer_text, is_correct)
  VALUES (v_uid, left(coalesce(p_code, ''), 500), v_ok);

  IF NOT v_ok THEN
    RETURN jsonb_build_object('status','incorrect','attempts_left', 4 - v_attempts);
  END IF;

  SELECT s.* INTO v_senior
    FROM public.senior_matches m
    JOIN public.seniors s ON s.id = m.senior_id
   WHERE m.student_email = lower(v_prof.email);
  IF v_senior.id IS NULL THEN RETURN jsonb_build_object('status','no_match'); END IF;

  UPDATE public.senior_matches
     SET revealed_at = coalesce(revealed_at, now())
   WHERE student_email = lower(v_prof.email);

  RETURN jsonb_build_object('status','revealed',
    'senior_name', v_senior.name,
    'senior_nickname', v_senior.nickname,
    'clue', v_senior.clue);
END;
$fn$;

-- ── สิทธิ์ (ค่าเริ่มต้นของ Postgres ให้ PUBLIC เรียกฟังก์ชันที่เพิ่งสร้าง) ──
REVOKE EXECUTE ON FUNCTION
  public.get_my_puzzle(),
  public.reveal_my_senior(text)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.get_my_puzzle(),
  public.reveal_my_senior(text)
TO authenticated;
