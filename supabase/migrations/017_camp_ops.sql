-- ============================================================
-- 017 เครื่องมือหน้างานของพี่ค่าย
--
-- 1. ปิด/เปิดที่นั่ง — ที่นั่งที่ไม่มีคนนั่งทำให้โซ่ทั้งเมืองค้างถาวร
--    เดิมทางออกเดียวคือ "ปลดที่นั่ง" ซึ่งบันทึกเป็นการไขผ่านของคนที่ไม่มีตัวตน
--    ตอนนี้ปิดที่นั่งได้ตรง ๆ โซ่จะข้ามไปคนถัดไปเอง และจำนวนปริศนาทั้งค่ายลดลงตามจริง
-- 2. ย้ายน้องรายคน — เดิมจัดใหม่ได้เฉพาะยกค่ายและเฉพาะก่อนมีคนตอบถูกคนแรก
--    น้องมาสาย ป่วย หรือสลับเมืองกลางค่าย จึงทำอะไรไม่ได้เลยนอกจากแก้ผ่าน SQL
--    ที่นั่งปลายทางมีคนอยู่แล้ว = สลับที่กัน (ไม่มีใครหลุดที่นั่งโดยไม่รู้ตัว)
-- 3. ตรวจความพร้อมก่อนวันงาน — รวมทุกอย่างที่ต้องครบไว้ในคำขอเดียว
-- 4. สถานะรายเมืองสำหรับดูหน้างาน — เมืองไหนค้าง ค้างที่ใคร ค้างมานานเท่าไหร่
--
-- รันต่อจาก 016 ได้เลย
-- ============================================================

-- ============================================================
-- 1. ปิด/เปิดที่นั่ง
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_set_seat_active(
  p_city_id smallint, p_seat_index smallint, p_active boolean, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_uid   uuid := auth.uid();
  v_puz   public.puzzles%ROWTYPE;
  v_owner text;
BEGIN
  IF NOT public.is_camp_admin() THEN RETURN jsonb_build_object('status','forbidden'); END IF;
  IF coalesce(btrim(p_reason), '') = '' THEN RETURN jsonb_build_object('status','reason_required'); END IF;

  -- ล็อกแถวเมืองก่อน กันน้องตอบถูกพร้อมกับตอนที่โซ่กำลังถูกคำนวณใหม่
  PERFORM 1 FROM public.city_progress WHERE city_id = p_city_id FOR UPDATE;

  SELECT * INTO v_puz FROM public.puzzles WHERE city_id = p_city_id AND seat_index = p_seat_index;
  IF v_puz.id IS NULL THEN RETURN jsonb_build_object('status','not_found'); END IF;
  IF v_puz.is_active = p_active THEN RETURN jsonb_build_object('status','no_change'); END IF;

  -- ปิดที่นั่งที่ไขผ่านไปแล้วไม่ได้ — solved_count จะลดลงและประตูที่เปิดแล้วอาจดูเหมือนถอยหลัง
  IF NOT p_active AND EXISTS (SELECT 1 FROM public.puzzle_solves WHERE puzzle_id = v_puz.id) THEN
    RETURN jsonb_build_object('status','already_solved');
  END IF;

  UPDATE public.puzzles SET is_active = p_active WHERE id = v_puz.id;

  SELECT display_name INTO v_owner FROM public.profiles
   WHERE city_id = p_city_id AND seat_index = p_seat_index;

  -- โซ่ขยับไปที่นั่งถัดไปที่ยังเปิดอยู่ · ปิดที่นั่งสุดท้ายที่ค้าง = ประตูอาจเปิดเองทันที
  PERFORM public.recompute_city_progress(p_city_id);
  PERFORM public.maybe_auto_unlock();

  INSERT INTO public.admin_audit (actor_id, action, payload, reason)
  VALUES (v_uid, 'set_seat_active',
          jsonb_build_object('city_id', p_city_id, 'seat_index', p_seat_index, 'active', p_active), p_reason);

  RETURN jsonb_build_object('status','ok','owner', coalesce(v_owner, ''));
END;
$fn$;

-- ============================================================
-- 2. ย้ายน้องรายคน
--    p_city_id / p_seat_index เป็น NULL ทั้งคู่ = เอาออกจากที่นั่ง (ยังอยู่ในระบบ)
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_move_student(
  p_email text, p_city_id smallint, p_seat_index smallint, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_uid       uuid := auth.uid();
  v_me        public.profiles%ROWTYPE;
  v_other     public.profiles%ROWTYPE;
  v_from_city smallint;
  v_from_seat smallint;
  v_solved    boolean := false;
BEGIN
  IF NOT public.is_camp_admin() THEN RETURN jsonb_build_object('status','forbidden'); END IF;
  IF coalesce(btrim(p_reason), '') = '' THEN RETURN jsonb_build_object('status','reason_required'); END IF;

  SELECT * INTO v_me FROM public.profiles WHERE lower(email) = lower(btrim(coalesce(p_email, '')));
  IF v_me.id IS NULL      THEN RETURN jsonb_build_object('status','student_not_found'); END IF;
  IF v_me.role <> 'student' THEN RETURN jsonb_build_object('status','not_a_student'); END IF;

  -- เมืองกับที่นั่งต้องมาด้วยกันเสมอ ครึ่ง ๆ กลาง ๆ ไม่ได้
  IF (p_city_id IS NULL) <> (p_seat_index IS NULL) THEN
    RETURN jsonb_build_object('status','invalid_seat');
  END IF;
  IF p_city_id IS NOT NULL THEN
    IF p_seat_index NOT BETWEEN 1 AND 6
       OR NOT EXISTS (SELECT 1 FROM public.cities WHERE id = p_city_id) THEN
      RETURN jsonb_build_object('status','invalid_seat');
    END IF;
  END IF;

  v_from_city := v_me.city_id;
  v_from_seat := v_me.seat_index;
  IF v_from_city IS NOT DISTINCT FROM p_city_id AND v_from_seat IS NOT DISTINCT FROM p_seat_index THEN
    RETURN jsonb_build_object('status','no_change');
  END IF;

  -- ล้างที่นั่งเดิมก่อนเสมอ ไม่อย่างนั้นการสลับที่จะชน unique index (city_id, seat_index) กลางคัน
  UPDATE public.profiles SET city_id = NULL, seat_index = NULL WHERE id = v_me.id;

  IF p_city_id IS NOT NULL THEN
    SELECT * INTO v_other FROM public.profiles
     WHERE city_id = p_city_id AND seat_index = p_seat_index;

    -- ที่นั่งปลายทางมีคนอยู่ = สลับกัน คนเดิมไปอยู่ที่นั่งเก่าของคนที่ย้าย
    -- (คนที่ย้ายไม่มีที่นั่งเดิม = คนเดิมหลุดที่นั่งไปอยู่นอกเมือง ซึ่งรายงานกลับไปให้เห็น)
    IF v_other.id IS NOT NULL THEN
      UPDATE public.profiles SET city_id = v_from_city, seat_index = v_from_seat WHERE id = v_other.id;
    END IF;

    UPDATE public.profiles SET city_id = p_city_id, seat_index = p_seat_index WHERE id = v_me.id;

    SELECT EXISTS (
      SELECT 1 FROM public.puzzles z
       JOIN public.puzzle_solves s ON s.puzzle_id = z.id
       WHERE z.city_id = p_city_id AND z.seat_index = p_seat_index)
      INTO v_solved;
  END IF;

  INSERT INTO public.admin_audit (actor_id, action, payload, reason)
  VALUES (v_uid, 'move_student',
          jsonb_build_object('email', lower(v_me.email),
                             'from', jsonb_build_object('city_id', v_from_city, 'seat_index', v_from_seat),
                             'to',   jsonb_build_object('city_id', p_city_id,  'seat_index', p_seat_index),
                             'swapped_with', lower(coalesce(v_other.email, ''))), p_reason);

  RETURN jsonb_build_object('status','ok',
    'swapped_with', coalesce(nullif(v_other.display_name, ''), v_other.email, ''),
    'swapped_to_none', v_other.id IS NOT NULL AND v_from_city IS NULL,
    'seat_solved', v_solved);
END;
$fn$;

-- ============================================================
-- 3. ตรวจความพร้อมก่อนวันงาน
-- ============================================================

-- ห่อผลของหนึ่งข้อตรวจ — เก็บตัวอย่างไว้ 8 รายการพอให้รู้ว่าต้องไปแก้ที่ไหน
CREATE OR REPLACE FUNCTION public.readiness_check(p_key text, p_items text[])
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $fn$
  SELECT jsonb_build_object(
    'key',    p_key,
    'count',  coalesce(array_length(p_items, 1), 0),
    'sample', to_jsonb(coalesce(p_items[1:8], ARRAY[]::text[])));
$fn$;

REVOKE EXECUTE ON FUNCTION public.readiness_check(text, text[]) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_readiness()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_names    text[];
  v_seats    text[];
  v_empty    text[];
  v_content  text[];
  v_codes    text[];
  v_nomatch  text[];
  v_noclue   text[];
  v_orphan   text[];
  v_students integer;
  v_active   integer;
  v_state    public.camp_state%ROWTYPE;
BEGIN
  IF NOT public.is_camp_admin() THEN RETURN jsonb_build_object('status','forbidden'); END IF;

  SELECT * INTO v_state FROM public.camp_state WHERE id = 1;
  SELECT count(*) INTO v_students FROM public.profiles WHERE role = 'student';
  SELECT count(*) INTO v_active   FROM public.puzzles WHERE is_active;

  -- ชื่อยังไม่ใช่ภาษาไทย (กฎเดียวกับ admin_set_student_names ใน 014)
  SELECT array_agg(lower(email) ORDER BY email) INTO v_names
    FROM public.profiles
   WHERE role = 'student'
     AND (display_name !~ '^[ก-๛]+( [ก-๛]+)+$' OR nickname !~ '^[ก-๛]{1,30}$');

  -- ยังไม่มีที่นั่ง
  SELECT array_agg(lower(email) ORDER BY email) INTO v_seats
    FROM public.profiles
   WHERE role = 'student' AND (city_id IS NULL OR seat_index IS NULL);

  -- ที่นั่งที่เปิดใช้แต่ไม่มีใครนั่ง — ตัวนี้แหละที่ทำให้โซ่ค้างทั้งเมือง
  SELECT array_agg(format('เมือง %s · #%s', lpad(z.city_id::text, 2, '0'), z.seat_index)
                   ORDER BY z.city_id, z.seat_index) INTO v_empty
    FROM public.puzzles z
   WHERE z.is_active
     AND NOT EXISTS (SELECT 1 FROM public.profiles p
                      WHERE p.city_id = z.city_id AND p.seat_index = z.seat_index);

  -- ไม่มีทั้งรูปและข้อความโจทย์ = น้องเปิดมาเจอแต่ชื่อด่าน
  SELECT array_agg(format('เมือง %s · #%s', lpad(city_id::text, 2, '0'), seat_index)
                   ORDER BY city_id, seat_index) INTO v_content
    FROM public.puzzles
   WHERE is_active AND media_url IS NULL AND btrim(prompt) = '';

  -- รหัสลับยังไม่ใช่ชุดสุ่ม 18 อักขระ (เช่นยังเป็นรหัสตัวอย่างจาก seed)
  SELECT array_agg(format('เมือง %s · #%s', lpad(city_id::text, 2, '0'), seat_index)
                   ORDER BY city_id, seat_index) INTO v_codes
    FROM public.puzzles
   WHERE is_active AND char_length(secret_code) <> 18;

  -- ยังไม่ได้จับคู่พี่รหัส
  SELECT array_agg(lower(p.email) ORDER BY p.email) INTO v_nomatch
    FROM public.profiles p
   WHERE p.role = 'student'
     AND NOT EXISTS (SELECT 1 FROM public.senior_matches m WHERE m.student_email = lower(p.email));

  -- พี่รหัสที่ยังไม่มีคำใบ้ (น้องถอดรหัสแล้วจะเห็นแค่ชื่อ)
  SELECT array_agg(s.name || CASE WHEN s.nickname <> '' THEN ' (' || s.nickname || ')' ELSE '' END
                   ORDER BY s.name) INTO v_noclue
    FROM public.seniors s
   WHERE btrim(s.clue) = ''
     AND EXISTS (SELECT 1 FROM public.senior_matches m WHERE m.senior_id = s.id);

  -- จับคู่ไว้แล้วแต่อีเมลนั้นยังไม่มีบัญชี (มักเป็นอีเมลพิมพ์ผิด)
  SELECT array_agg(m.student_email ORDER BY m.student_email) INTO v_orphan
    FROM public.senior_matches m
   WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE lower(p.email) = m.student_email);

  RETURN jsonb_build_object(
    'status', 'ok',
    'students', v_students,
    'active_puzzles', v_active,
    'camp_open', v_state.camp_open,
    'decrypt_unlocked', v_state.decrypt_unlocked,
    'opens_at', v_state.opens_at,
    'checks', jsonb_build_array(
      public.readiness_check('student_names',  v_names),
      public.readiness_check('student_seats',  v_seats),
      public.readiness_check('empty_seats',    v_empty),
      public.readiness_check('puzzle_content', v_content),
      public.readiness_check('puzzle_codes',   v_codes),
      public.readiness_check('senior_matches', v_nomatch),
      public.readiness_check('senior_clues',   v_noclue),
      public.readiness_check('orphan_matches', v_orphan)));
END;
$fn$;

-- ============================================================
-- 4. สถานะรายเมืองสำหรับดูหน้างาน
--    ชื่อคนที่ถึงตาอยู่ตอนนี้ + ค้างมานานกี่นาที = รู้ว่าต้องเดินไปช่วยเมืองไหนก่อน
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_city_status()
RETURNS TABLE (
  city_id smallint, name_en text, current_seat smallint,
  solved integer, total integer, done boolean,
  last_solved_at timestamptz, idle_minutes integer,
  waiting_name text, waiting_email text, waiting_seated boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
BEGIN
  IF NOT public.is_camp_admin() THEN RETURN; END IF;

  RETURN QUERY
  SELECT c.id,
         c.name_en,
         cp.current_seat,
         cp.solved_count::integer,
         (SELECT count(*)::integer FROM public.puzzles z WHERE z.city_id = c.id AND z.is_active),
         cp.current_seat > 6,
         cp.last_solved_at,
         -- ไม่เคยมีใครตอบถูกเลย = นับจากเวลาที่เปิดค่าย
         (EXTRACT(EPOCH FROM (now() - coalesce(cp.last_solved_at, cs.decrypt_unlocked_at, cs.opens_at, cp.updated_at))) / 60)::integer,
         coalesce(p.display_name, ''),
         lower(coalesce(p.email, '')),
         p.id IS NOT NULL
    FROM public.cities c
    JOIN public.city_progress cp ON cp.city_id = c.id
    CROSS JOIN (SELECT * FROM public.camp_state WHERE id = 1) cs
    LEFT JOIN public.profiles p ON p.city_id = c.id AND p.seat_index = cp.current_seat
   ORDER BY c.id;
END;
$fn$;

-- ============================================================
-- 5. ฟอร์มแก้ปริศนาต้องรู้ว่าที่นั่งนี้เปิดอยู่หรือปิดไว้
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_get_puzzle(p_city_id smallint, p_seat_index smallint)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_puz   public.puzzles%ROWTYPE;
  v_owner text;
BEGIN
  IF NOT public.is_camp_admin() THEN RETURN jsonb_build_object('status','forbidden'); END IF;

  SELECT * INTO v_puz FROM public.puzzles WHERE city_id = p_city_id AND seat_index = p_seat_index;
  IF v_puz.id IS NULL THEN RETURN jsonb_build_object('status','not_found'); END IF;

  SELECT display_name INTO v_owner FROM public.profiles
   WHERE city_id = p_city_id AND seat_index = p_seat_index;

  RETURN jsonb_build_object('status','ok',
    'title', v_puz.title,
    'prompt', v_puz.prompt,
    'hint', v_puz.hint,
    'media_url', v_puz.media_url,
    'secret_code', v_puz.secret_code,
    'is_active', v_puz.is_active,
    'owner', coalesce(v_owner, ''),
    'is_solved', EXISTS (SELECT 1 FROM public.puzzle_solves WHERE puzzle_id = v_puz.id));
END;
$fn$;

-- ============================================================
-- 6. สิทธิ์ — ค่าเริ่มต้นของ Postgres/Supabase ให้ PUBLIC และ anon เรียกได้ ต้องถอนเอง
-- ============================================================
REVOKE EXECUTE ON FUNCTION
  public.admin_set_seat_active(smallint, smallint, boolean, text),
  public.admin_move_student(text, smallint, smallint, text),
  public.admin_readiness(),
  public.admin_city_status()
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.admin_set_seat_active(smallint, smallint, boolean, text),
  public.admin_move_student(text, smallint, smallint, text),
  public.admin_readiness(),
  public.admin_city_status()
TO authenticated;
