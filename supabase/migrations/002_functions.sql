-- ============================================================
-- 002 ฟังก์ชันและตรรกะทั้งหมด
-- ตรรกะอยู่ในฐานข้อมูล เพราะเป็นที่เดียวที่ client เลี่ยงไม่ได้
-- ============================================================

-- ── ทำให้คำตอบเทียบกันได้ ────────────────────────────────────
-- ใช้ทั้งตอน seed เฉลยและตอนตรวจ ต้องเป็นฟังก์ชันเดียวกันเสมอ
-- มิฉะนั้นน้องตอบถูกแต่ระบบบอกผิด
CREATE OR REPLACE FUNCTION public.normalize_answer(p text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(regexp_replace(normalize(btrim(coalesce(p, '')), NFC), '\s+', ' ', 'g'));
$$;

CREATE OR REPLACE FUNCTION public.hash_answer(p text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT encode(extensions.digest(public.normalize_answer(p), 'sha256'), 'hex');
$$;

-- ── ใครมีสิทธิ์อะไร ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_camp_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
$$;

-- เมืองของฉัน — ต้องเป็น SECURITY DEFINER เพื่ออ่าน profiles โดยข้าม RLS
-- ถ้า policy ของ profiles ไป SELECT profiles เองตรง ๆ Postgres จะวนไม่รู้จบ
CREATE OR REPLACE FUNCTION public.my_city_id()
RETURNS smallint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT city_id FROM public.profiles WHERE id = auth.uid();
$$;

-- กฎอีเมลของค่าย — นักเรียนต้องเป็น sXXXXX@bj.ac.th, พี่ค่ายมาจาก admin_emails
CREATE OR REPLACE FUNCTION public.camp_email_role(p_email text)
RETURNS public.user_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.admin_emails WHERE lower(email) = lower(p_email))
      THEN 'admin'::public.user_role
    WHEN lower(p_email) ~ '^s[0-9]{5}@bj\.ac\.th$'
      THEN 'student'::public.user_role
    ELSE NULL
  END;
$$;

-- ── สร้างโปรไฟล์ตอนสมัคร + ปฏิเสธอีเมลนอกกฎ ─────────────────
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
    COALESCE(r.nickname, ''),
    v_role,
    CASE WHEN v_role = 'student' THEN split_part(NEW.email, '@', 1) END,
    r.city_id,
    r.seat_index
  );

  UPDATE public.roster SET account_created_at = now() WHERE lower(email) = lower(NEW.email);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── กันการยกระดับสิทธิ์ตัวเอง ────────────────────────────────
-- สิทธิ์ระดับคอลัมน์ใน 003 คือด่านหลัก อันนี้เป็นตาข่ายรองรับ
CREATE OR REPLACE FUNCTION public.prevent_privilege_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF (NEW.role IS DISTINCT FROM OLD.role
      OR NEW.city_id IS DISTINCT FROM OLD.city_id
      OR NEW.seat_index IS DISTINCT FROM OLD.seat_index)
     AND session_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'role / city_id / seat_index เปลี่ยนผ่าน UPDATE ตรง ๆ ไม่ได้';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_privilege_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_privilege_change();

-- ประวัติการแก้ประกาศต้องเชื่อถือได้ จึงให้ฐานข้อมูลเขียนเอง
CREATE OR REPLACE FUNCTION public.stamp_announcement_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_stamp_announcement_update
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.stamp_announcement_update();

-- ============================================================
-- หัวใจของระบบ: ลูกโซ่ปริศนา
-- ============================================================
CREATE OR REPLACE FUNCTION public.submit_city_answer(p_puzzle_id integer, p_answer text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_prof     public.profiles%ROWTYPE;
  v_puz      public.puzzles%ROWTYPE;
  v_prog     public.city_progress%ROWTYPE;
  v_attempts integer;
  v_total    integer;
  v_active   integer;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('status', 'unauthorized'); END IF;

  IF NOT (SELECT camp_open FROM public.camp_state WHERE id = 1) THEN
    RETURN jsonb_build_object('status', 'camp_closed');
  END IF;

  SELECT * INTO v_prof FROM public.profiles WHERE id = v_uid;
  SELECT * INTO v_puz  FROM public.puzzles  WHERE id = p_puzzle_id AND is_active;

  -- ตอบได้เฉพาะที่นั่งของตัวเองเท่านั้น ไม่เชื่อ id ที่ client ส่งมา
  IF v_puz.id IS NULL
     OR v_puz.city_id    IS DISTINCT FROM v_prof.city_id
     OR v_puz.seat_index IS DISTINCT FROM v_prof.seat_index THEN
    RETURN jsonb_build_object('status', 'not_your_puzzle');
  END IF;

  -- ล็อกแถวเมืองไว้ก่อน กันสองคนกดพร้อมกันแล้วโซ่เลื่อนซ้อน
  SELECT * INTO v_prog FROM public.city_progress WHERE city_id = v_puz.city_id FOR UPDATE;

  IF EXISTS (SELECT 1 FROM public.puzzle_solves WHERE puzzle_id = v_puz.id) THEN
    RETURN jsonb_build_object('status', 'already_solved', 'secret_code', v_puz.secret_code);
  END IF;

  IF v_prog.current_seat <> v_puz.seat_index THEN
    RETURN jsonb_build_object('status', 'locked', 'current_seat', v_prog.current_seat);
  END IF;

  SELECT count(*) INTO v_attempts FROM public.submissions
   WHERE user_id = v_uid AND puzzle_id = v_puz.id
     AND submitted_at > now() - interval '10 minutes';
  IF v_attempts >= 5 THEN
    RETURN jsonb_build_object('status', 'rate_limited');
  END IF;

  IF public.hash_answer(p_answer) <> v_puz.answer_hash THEN
    INSERT INTO public.submissions (user_id, puzzle_id, answer_text, is_correct)
    VALUES (v_uid, v_puz.id, p_answer, false);
    RETURN jsonb_build_object('status', 'incorrect',
                              'attempts_left', 4 - v_attempts);
  END IF;

  INSERT INTO public.submissions (user_id, puzzle_id, answer_text, is_correct)
  VALUES (v_uid, v_puz.id, p_answer, true);

  INSERT INTO public.puzzle_solves (puzzle_id, user_id, via)
  VALUES (v_puz.id, v_uid, 'answer');

  UPDATE public.city_progress
     SET current_seat   = v_puz.seat_index + 1,
         solved_count   = solved_count + 1,
         last_solved_by = v_uid,
         last_solved_at = now(),
         updated_at     = now()
   WHERE city_id = v_puz.city_id;

  -- ปลดเครื่องถอดรหัสอัตโนมัติ นับจากจำนวนปริศนาที่เปิดใช้จริง ไม่ hardcode 36
  SELECT coalesce(sum(solved_count), 0) INTO v_total  FROM public.city_progress;
  SELECT count(*)                        INTO v_active FROM public.puzzles WHERE is_active;

  IF v_total >= v_active AND v_active > 0 THEN
    UPDATE public.camp_state
       SET decrypt_unlocked    = true,
           decrypt_unlock_mode = 'auto',
           decrypt_unlocked_at = now(),
           updated_at          = now()
     WHERE id = 1 AND decrypt_unlocked = false;
  END IF;

  RETURN jsonb_build_object('status', 'correct', 'secret_code', v_puz.secret_code);
END;
$$;

-- ── โจทย์ของฉัน — ไม่คืนข้อความโจทย์เมื่อยังไม่ถึงตา ──────────
CREATE OR REPLACE FUNCTION public.get_my_puzzle()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_prof public.profiles%ROWTYPE;
  v_puz  public.puzzles%ROWTYPE;
  v_cur  smallint;
  v_done boolean;
  v_waiting text;
BEGIN
  SELECT * INTO v_prof FROM public.profiles WHERE id = auth.uid();
  IF v_prof.id IS NULL THEN RETURN jsonb_build_object('status', 'unauthorized'); END IF;
  IF v_prof.city_id IS NULL OR v_prof.seat_index IS NULL THEN
    RETURN jsonb_build_object('status', 'unassigned');
  END IF;

  SELECT * INTO v_puz FROM public.puzzles
   WHERE city_id = v_prof.city_id AND seat_index = v_prof.seat_index AND is_active;
  IF v_puz.id IS NULL THEN RETURN jsonb_build_object('status', 'no_puzzle'); END IF;

  SELECT current_seat INTO v_cur FROM public.city_progress WHERE city_id = v_prof.city_id;
  SELECT EXISTS (SELECT 1 FROM public.puzzle_solves WHERE puzzle_id = v_puz.id) INTO v_done;

  IF v_done THEN
    RETURN jsonb_build_object('status','solved','title',v_puz.title,
      'prompt',v_puz.prompt,'secret_code',v_puz.secret_code,'seat_index',v_prof.seat_index);
  ELSIF v_cur = v_prof.seat_index THEN
    RETURN jsonb_build_object('status','active','puzzle_id',v_puz.id,'title',v_puz.title,
      'prompt',v_puz.prompt,'hint',v_puz.hint,'media_url',v_puz.media_url,
      'seat_index',v_prof.seat_index,
      'attempts_left', 5 - (SELECT count(*) FROM public.submissions
                             WHERE user_id = v_prof.id AND puzzle_id = v_puz.id
                               AND submitted_at > now() - interval '10 minutes'));
  ELSE
    SELECT display_name INTO v_waiting FROM public.profiles
     WHERE city_id = v_prof.city_id AND seat_index = v_cur;
    RETURN jsonb_build_object('status','locked','current_seat',v_cur,
      'seat_index',v_prof.seat_index,'waiting_on',coalesce(v_waiting,''));
  END IF;
END;
$$;

-- ── กระดานเมือง — คืนแค่สถานะ ไม่มีโจทย์/เฉลย/รหัสลับ ─────────
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
   ORDER BY z.seat_index;
$$;

-- ── ด่านสุดท้าย ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_final_cipher()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_state public.camp_state%ROWTYPE; v_sec public.camp_secrets%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('status','unauthorized'); END IF;
  SELECT * INTO v_state FROM public.camp_state   WHERE id = 1;
  SELECT * INTO v_sec   FROM public.camp_secrets WHERE id = 1;

  IF NOT v_state.decrypt_unlocked THEN
    RETURN jsonb_build_object('status','locked');
  END IF;
  RETURN jsonb_build_object('status','unlocked','prompt',v_sec.final_prompt,
                            'mode',v_state.decrypt_unlock_mode);
END;
$$;

CREATE OR REPLACE FUNCTION public.check_final_cipher(p_answer text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_sec public.camp_secrets%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('status','unauthorized'); END IF;
  IF NOT (SELECT decrypt_unlocked FROM public.camp_state WHERE id = 1) THEN
    RETURN jsonb_build_object('status','locked');
  END IF;

  SELECT * INTO v_sec FROM public.camp_secrets WHERE id = 1;
  IF v_sec.final_hash IS NULL THEN RETURN jsonb_build_object('status','not_ready'); END IF;

  IF public.hash_answer(p_answer) = v_sec.final_hash THEN
    RETURN jsonb_build_object('status','correct','reward',v_sec.final_reward);
  END IF;
  RETURN jsonb_build_object('status','incorrect');
END;
$$;

-- ============================================================
-- คำสั่งของพี่ค่าย — ตรวจสิทธิ์เองทุกตัว และเขียน audit เสมอ
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_set_camp_open(
  p_open boolean, p_opens_at timestamptz DEFAULT NULL, p_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF NOT public.is_camp_admin() THEN RETURN jsonb_build_object('status','forbidden'); END IF;

  UPDATE public.camp_state
     SET camp_open = p_open, opens_at = COALESCE(p_opens_at, opens_at), updated_at = now()
   WHERE id = 1;

  INSERT INTO public.admin_audit (actor_id, action, payload, reason)
  VALUES (v_uid, 'set_camp_open', jsonb_build_object('open', p_open), p_reason);

  RETURN jsonb_build_object('status','ok','camp_open',p_open);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_decrypt(p_unlocked boolean, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF NOT public.is_camp_admin() THEN RETURN jsonb_build_object('status','forbidden'); END IF;
  IF coalesce(btrim(p_reason), '') = '' THEN
    RETURN jsonb_build_object('status','reason_required');
  END IF;

  UPDATE public.camp_state
     SET decrypt_unlocked    = p_unlocked,
         decrypt_unlock_mode = 'manual',
         decrypt_unlocked_at = CASE WHEN p_unlocked THEN now() END,
         decrypt_unlocked_by = CASE WHEN p_unlocked THEN v_uid END,
         updated_at          = now()
   WHERE id = 1;

  INSERT INTO public.admin_audit (actor_id, action, payload, reason)
  VALUES (v_uid, 'set_decrypt', jsonb_build_object('unlocked', p_unlocked), p_reason);

  RETURN jsonb_build_object('status','ok','unlocked',p_unlocked);
END;
$$;

-- ปลดที่นั่งที่ค้าง — น้องไม่มาหรือเข้าระบบไม่ได้ อีก 5 คนหลังจะติดทั้งเมือง
CREATE OR REPLACE FUNCTION public.admin_force_solve_seat(
  p_city_id smallint, p_seat_index smallint, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_puz   public.puzzles%ROWTYPE;
  v_owner uuid;
  v_total integer; v_active integer;
BEGIN
  IF NOT public.is_camp_admin() THEN RETURN jsonb_build_object('status','forbidden'); END IF;
  IF coalesce(btrim(p_reason), '') = '' THEN
    RETURN jsonb_build_object('status','reason_required');
  END IF;

  SELECT * INTO v_puz FROM public.puzzles
   WHERE city_id = p_city_id AND seat_index = p_seat_index;
  IF v_puz.id IS NULL THEN RETURN jsonb_build_object('status','not_found'); END IF;

  IF EXISTS (SELECT 1 FROM public.puzzle_solves WHERE puzzle_id = v_puz.id) THEN
    RETURN jsonb_build_object('status','already_solved');
  END IF;

  SELECT id INTO v_owner FROM public.profiles
   WHERE city_id = p_city_id AND seat_index = p_seat_index;

  INSERT INTO public.puzzle_solves (puzzle_id, user_id, via)
  VALUES (v_puz.id, coalesce(v_owner, v_uid), 'admin');

  UPDATE public.city_progress
     SET current_seat = GREATEST(current_seat, p_seat_index + 1),
         solved_count = solved_count + 1,
         updated_at   = now()
   WHERE city_id = p_city_id;

  SELECT coalesce(sum(solved_count), 0) INTO v_total  FROM public.city_progress;
  SELECT count(*)                        INTO v_active FROM public.puzzles WHERE is_active;
  IF v_total >= v_active AND v_active > 0 THEN
    UPDATE public.camp_state
       SET decrypt_unlocked = true, decrypt_unlock_mode = 'auto',
           decrypt_unlocked_at = now(), updated_at = now()
     WHERE id = 1 AND decrypt_unlocked = false;
  END IF;

  INSERT INTO public.admin_audit (actor_id, action, payload, reason)
  VALUES (v_uid, 'force_solve_seat',
          jsonb_build_object('city_id', p_city_id, 'seat_index', p_seat_index), p_reason);

  RETURN jsonb_build_object('status','ok');
END;
$$;

-- สุ่มจัดน้องลงเมือง — seed เดิมให้ผลเดิมเสมอ จะได้ทวนซ้ำได้ว่าใครอยู่ไหน
CREATE OR REPLACE FUNCTION public.admin_assign_participants(p_seed text, p_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_uid uuid := auth.uid(); v_count integer := 0;
BEGIN
  IF NOT public.is_camp_admin() THEN RETURN jsonb_build_object('status','forbidden'); END IF;

  IF EXISTS (SELECT 1 FROM public.puzzle_solves) THEN
    RETURN jsonb_build_object('status','already_started');
  END IF;

  WITH shuffled AS (
    SELECT id, row_number() OVER (
             ORDER BY extensions.digest(p_seed || id::text, 'sha256')
           ) - 1 AS n
      FROM public.profiles
     WHERE role = 'student'
  ), placed AS (
    SELECT id, (n / 6 + 1)::smallint AS city_id, (n % 6 + 1)::smallint AS seat_index
      FROM shuffled WHERE n < 36
  )
  UPDATE public.profiles p
     SET city_id = placed.city_id, seat_index = placed.seat_index
    FROM placed WHERE p.id = placed.id;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  INSERT INTO public.admin_audit (actor_id, action, payload, reason)
  VALUES (v_uid, 'assign_participants',
          jsonb_build_object('seed', p_seed, 'assigned', v_count), p_reason);

  RETURN jsonb_build_object('status','ok','assigned',v_count);
END;
$$;

-- แก้ปริศนารายข้อ — เฉลยถูกแฮชในฐานข้อมูล ไม่เคยถูกเก็บเป็นข้อความ
CREATE OR REPLACE FUNCTION public.admin_upsert_puzzle(
  p_city_id smallint, p_seat_index smallint,
  p_title text, p_prompt text, p_hint text,
  p_answer text, p_secret_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF NOT public.is_camp_admin() THEN RETURN jsonb_build_object('status','forbidden'); END IF;

  INSERT INTO public.puzzles (city_id, seat_index, title, prompt, hint, answer_hash, secret_code)
  VALUES (p_city_id, p_seat_index, p_title, p_prompt, p_hint,
          public.hash_answer(p_answer), p_secret_code)
  ON CONFLICT (city_id, seat_index) DO UPDATE
    SET title       = EXCLUDED.title,
        prompt      = EXCLUDED.prompt,
        hint        = EXCLUDED.hint,
        -- ส่งคำตอบว่างมา = ไม่เปลี่ยนเฉลยเดิม
        answer_hash = CASE WHEN coalesce(btrim(p_answer), '') = ''
                           THEN public.puzzles.answer_hash ELSE EXCLUDED.answer_hash END,
        secret_code = EXCLUDED.secret_code;

  INSERT INTO public.admin_audit (actor_id, action, payload)
  VALUES (v_uid, 'upsert_puzzle',
          jsonb_build_object('city_id', p_city_id, 'seat_index', p_seat_index));

  RETURN jsonb_build_object('status','ok');
END;
$$;
