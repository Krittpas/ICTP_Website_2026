-- ============================================================
-- 006 แก้ตรรกะลูกโซ่หลังใช้งานจริง
--
-- 1. ปลดที่นั่งข้ามลำดับแล้วที่นั่งตรงกลางค้างถาวร
--    เดิม admin_force_solve_seat ใช้ GREATEST(current_seat, seat + 1)
--    ปลดที่นั่ง 5 ตอนโซ่อยู่ที่ 2 → current_seat = 6 แล้วที่นั่ง 2–4 ไม่มีวันถึงตา
--    ตอนนี้ทุกครั้งที่มีการผ่าน จะคำนวณตำแหน่งโซ่ใหม่จากข้อมูลจริง
--    = ที่นั่งที่ยังไม่ผ่านที่เลขน้อยที่สุด (ข้ามที่นั่งที่ผ่านแล้วหรือปิดใช้)
-- 2. ล็อกเครื่องถอดรหัสกลับแล้ว decrypt_unlock_mode ยังค้างเป็น 'manual'
-- 3. หน้าเว็บต้องรู้จำนวนปริศนาที่เปิดใช้จริง แต่ตาราง puzzles อ่านตรงไม่ได้
--
-- รันต่อจาก 005 ได้เลย ทุกตัวเป็น CREATE OR REPLACE
-- ============================================================

-- ── คำนวณตำแหน่งโซ่ของเมืองใหม่จากข้อมูลจริง ─────────────────
CREATE OR REPLACE FUNCTION public.recompute_city_progress(p_city_id smallint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_next   smallint;
  v_solved smallint;
BEGIN
  SELECT min(z.seat_index) INTO v_next
    FROM public.puzzles z
   WHERE z.city_id = p_city_id AND z.is_active
     AND NOT EXISTS (SELECT 1 FROM public.puzzle_solves s WHERE s.puzzle_id = z.id);

  SELECT count(*) INTO v_solved
    FROM public.puzzles z
    JOIN public.puzzle_solves s ON s.puzzle_id = z.id
   WHERE z.city_id = p_city_id AND z.is_active;

  UPDATE public.city_progress
     SET current_seat = coalesce(v_next, 7),   -- 7 = ผ่านครบทั้งเมืองแล้ว
         solved_count = v_solved,
         updated_at   = now()
   WHERE city_id = p_city_id;
END;
$$;

-- ── ปลดเครื่องถอดรหัสอัตโนมัติเมื่อครบทุกข้อที่เปิดใช้ ─────────
CREATE OR REPLACE FUNCTION public.maybe_auto_unlock()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_total integer; v_active integer;
BEGIN
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
END;
$$;

-- ฟังก์ชันภายใน ไม่ให้ client เรียกตรง
REVOKE EXECUTE ON FUNCTION public.recompute_city_progress(smallint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.maybe_auto_unlock()               FROM PUBLIC, anon, authenticated;

-- ── ส่งคำตอบ ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_city_answer(p_puzzle_id integer, p_answer text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_prof     public.profiles%ROWTYPE;
  v_puz      public.puzzles%ROWTYPE;
  v_prog     public.city_progress%ROWTYPE;
  v_attempts integer;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('status', 'unauthorized'); END IF;

  IF NOT (SELECT camp_open FROM public.camp_state WHERE id = 1) THEN
    RETURN jsonb_build_object('status', 'camp_closed');
  END IF;

  SELECT * INTO v_prof FROM public.profiles WHERE id = v_uid;
  SELECT * INTO v_puz  FROM public.puzzles  WHERE id = p_puzzle_id AND is_active;

  IF v_puz.id IS NULL
     OR v_puz.city_id    IS DISTINCT FROM v_prof.city_id
     OR v_puz.seat_index IS DISTINCT FROM v_prof.seat_index THEN
    RETURN jsonb_build_object('status', 'not_your_puzzle');
  END IF;

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
    RETURN jsonb_build_object('status', 'incorrect', 'attempts_left', 4 - v_attempts);
  END IF;

  INSERT INTO public.submissions (user_id, puzzle_id, answer_text, is_correct)
  VALUES (v_uid, v_puz.id, p_answer, true);

  INSERT INTO public.puzzle_solves (puzzle_id, user_id, via)
  VALUES (v_puz.id, v_uid, 'answer');

  PERFORM public.recompute_city_progress(v_puz.city_id);
  UPDATE public.city_progress
     SET last_solved_by = v_uid, last_solved_at = now()
   WHERE city_id = v_puz.city_id;

  PERFORM public.maybe_auto_unlock();

  RETURN jsonb_build_object('status', 'correct', 'secret_code', v_puz.secret_code);
END;
$$;

-- ── ปลดที่นั่งที่ค้าง ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_force_solve_seat(
  p_city_id smallint, p_seat_index smallint, p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_puz   public.puzzles%ROWTYPE;
  v_owner uuid;
BEGIN
  IF NOT public.is_camp_admin() THEN RETURN jsonb_build_object('status','forbidden'); END IF;
  IF coalesce(btrim(p_reason), '') = '' THEN
    RETURN jsonb_build_object('status','reason_required');
  END IF;

  PERFORM 1 FROM public.city_progress WHERE city_id = p_city_id FOR UPDATE;

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

  -- ปลดข้ามลำดับได้ โซ่จะหยุดที่ที่นั่งแรกที่ยังไม่ผ่าน แล้วกระโดดข้ามที่นั่งที่ปลดไว้แล้วเอง
  PERFORM public.recompute_city_progress(p_city_id);
  PERFORM public.maybe_auto_unlock();

  INSERT INTO public.admin_audit (actor_id, action, payload, reason)
  VALUES (v_uid, 'force_solve_seat',
          jsonb_build_object('city_id', p_city_id, 'seat_index', p_seat_index), p_reason);

  RETURN jsonb_build_object('status','ok');
END;
$$;

-- ── ปล่อย/ล็อกเครื่องถอดรหัส ─────────────────────────────────
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
         decrypt_unlock_mode = CASE WHEN p_unlocked THEN 'manual'::public.unlock_mode END,
         decrypt_unlocked_at = CASE WHEN p_unlocked THEN now() END,
         decrypt_unlocked_by = CASE WHEN p_unlocked THEN v_uid END,
         updated_at          = now()
   WHERE id = 1;

  INSERT INTO public.admin_audit (actor_id, action, payload, reason)
  VALUES (v_uid, 'set_decrypt', jsonb_build_object('unlocked', p_unlocked), p_reason);

  RETURN jsonb_build_object('status','ok','unlocked',p_unlocked);
END;
$$;

-- ── จำนวนปริศนาที่เปิดใช้รายเมือง — ตัวเลขนี้ไม่ใช่ความลับ ─────
CREATE OR REPLACE FUNCTION public.get_puzzle_totals()
RETURNS TABLE (city_id smallint, total integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT c.id, count(z.id)::integer
    FROM public.cities c
    LEFT JOIN public.puzzles z ON z.city_id = c.id AND z.is_active
   GROUP BY c.id
   ORDER BY c.id;
$$;
GRANT EXECUTE ON FUNCTION public.get_puzzle_totals() TO anon, authenticated;

-- ซ่อมเมืองที่อาจค้างจากบั๊กเดิมไปแล้ว
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.cities LOOP
    PERFORM public.recompute_city_progress(r.id);
  END LOOP;
  UPDATE public.camp_state SET decrypt_unlock_mode = NULL
   WHERE id = 1 AND decrypt_unlocked = false;
END;
$$;
