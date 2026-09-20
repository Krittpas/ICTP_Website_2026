-- ============================================================
-- 007 แก้บั๊กที่เจอก่อนใช้งานจริง
--
-- 1. trigger กันยกระดับสิทธิ์บล็อก RPC ของพี่ค่ายไปด้วย
--    เดิมเช็ก session_user แต่เวลาเรียกผ่าน PostgREST session_user เป็น 'authenticator' เสมอ
--    (SECURITY DEFINER เปลี่ยนแค่ current_user ไม่เปลี่ยน session_user)
--    ปุ่ม "สุ่มจัดน้องลง 6 เมือง" จึงโดน exception ทุกครั้ง
--    ตอนนี้เช็ก current_user แทน: นักเรียนแก้ตรง = authenticated → บล็อก
--    RPC ของพี่ค่าย (SECURITY DEFINER เจ้าของเป็น postgres) = postgres → ผ่าน
--    trigger ต้องเป็น SECURITY INVOKER ไม่อย่างนั้น current_user จะเป็นเจ้าของ trigger เสมอ
-- 2. จัดเมืองซ้ำแล้วชน unique index (city_id, seat_index)
--    UPDATE ที่สลับที่นั่งกันถูกตรวจ unique ทีละแถว จึงชนกับแถวที่ยังไม่ได้ย้าย
--    ตอนนี้ล้างที่นั่งเดิมทั้งหมดก่อน แล้วค่อยจัดใหม่ในทรานแซกชันเดียวกัน
--    น้องคนที่เกิน 36 คนจึงไม่ค้างที่นั่งเก่าไว้ด้วย
-- 3. get_my_puzzle คืนข้อความโจทย์ของที่นั่ง 1 ก่อนค่ายเปิด
--    ตอนนี้ถ้ายังไม่เปิดค่ายจะคืน camp_closed แทน (ที่นั่งที่ผ่านแล้วยังเห็นรหัสลับของตัวเองได้)
--
-- รันต่อจาก 006 ได้เลย ทุกตัวเป็น CREATE OR REPLACE
-- ============================================================

-- ── 1. กันยกระดับสิทธิ์ ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.prevent_privilege_change()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF (NEW.role IS DISTINCT FROM OLD.role
      OR NEW.city_id IS DISTINCT FROM OLD.city_id
      OR NEW.seat_index IS DISTINCT FROM OLD.seat_index)
     AND current_user IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'role / city_id / seat_index เปลี่ยนผ่าน UPDATE ตรง ๆ ไม่ได้';
  END IF;
  RETURN NEW;
END;
$$;

-- ── 2. สุ่มจัดน้องลงเมือง ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_assign_participants(p_seed text, p_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_uid uuid := auth.uid(); v_count integer := 0;
BEGIN
  IF NOT public.is_camp_admin() THEN RETURN jsonb_build_object('status','forbidden'); END IF;

  IF EXISTS (SELECT 1 FROM public.puzzle_solves) THEN
    RETURN jsonb_build_object('status','already_started');
  END IF;

  -- ล้างที่นั่งเดิมก่อน ไม่อย่างนั้นการสลับที่นั่งจะชน unique index กลางคัน
  UPDATE public.profiles
     SET city_id = NULL, seat_index = NULL
   WHERE role = 'student' AND (city_id IS NOT NULL OR seat_index IS NOT NULL);

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

-- ── 3. โจทย์ของฉัน — ไม่คืนโจทย์ก่อนค่ายเปิด ─────────────────
CREATE OR REPLACE FUNCTION public.get_my_puzzle()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_prof public.profiles%ROWTYPE;
  v_puz  public.puzzles%ROWTYPE;
  v_cur  smallint;
  v_done boolean;
  v_open boolean;
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

  SELECT current_seat INTO v_cur  FROM public.city_progress WHERE city_id = v_prof.city_id;
  SELECT camp_open    INTO v_open FROM public.camp_state    WHERE id = 1;
  SELECT EXISTS (SELECT 1 FROM public.puzzle_solves WHERE puzzle_id = v_puz.id) INTO v_done;

  IF v_done THEN
    RETURN jsonb_build_object('status','solved','title',v_puz.title,
      'prompt',v_puz.prompt,'secret_code',v_puz.secret_code,'seat_index',v_prof.seat_index);
  ELSIF NOT coalesce(v_open, false) THEN
    RETURN jsonb_build_object('status','camp_closed','seat_index',v_prof.seat_index);
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
