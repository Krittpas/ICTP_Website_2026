-- ============================================================
-- 009 แก้การแสดงผลโซ่ + ปิดช่องปริศนาที่ไม่มีเฉลย
--
-- 1. แถบความคืบหน้ารายเมืองเดาสถานะจาก current_seat อย่างเดียว
--    ถือว่าทุกที่นั่งหลังโซ่ยังล็อก แต่ตั้งแต่ 006 พี่ค่ายปลดที่นั่งข้ามลำดับได้
--    ที่นั่งที่ปลดไว้ล่วงหน้าจึงขึ้นว่า "ยังล็อก" ทั้งที่ผ่านแล้ว
--    ตอนนี้มี get_camp_seats() คืนสถานะจริงทุกที่นั่งทุกเมือง
--    (ไม่มีชื่อคน ไม่มีโจทย์ ไม่มีรหัสลับ — แค่ผ่าน/ถึงตา/ล็อก ซึ่ง city_progress เปิดเผยอยู่แล้ว)
-- 2. เพิ่มปริศนาข้อใหม่โดยเว้นช่องเฉลย = เก็บแฮชของสตริงว่าง
--    action ตัดคำตอบว่างทิ้งก่อนส่ง ข้อนั้นจึงไม่มีวันตอบถูก และโซ่ทั้งเมืองค้าง
--    ตอนนี้ข้อใหม่ต้องมีเฉลยเสมอ (แก้ข้อเดิมยังเว้นว่างได้ = ไม่เปลี่ยนเฉลย)
-- 3. เพิ่มปริศนาข้อใหม่แล้วตำแหน่งโซ่ไม่ถูกคำนวณใหม่
--    เช่นเมืองที่ผ่านครบแล้ว (current_seat = 7) เพิ่มที่นั่ง 6 ภายหลัง โซ่ไม่ย้อนกลับมาที่ 6
--
-- รันต่อจาก 008 ได้เลย
-- ============================================================

-- ── 1. สถานะทุกที่นั่งทุกเมือง ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_camp_seats()
RETURNS TABLE (city_id smallint, seat_index smallint, status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT z.city_id,
         z.seat_index,
         CASE WHEN s.id IS NOT NULL               THEN 'solved'
              WHEN z.seat_index = cp.current_seat THEN 'active'
              ELSE 'locked' END
    FROM public.puzzles z
    JOIN public.city_progress cp ON cp.city_id = z.city_id
    LEFT JOIN public.puzzle_solves s ON s.puzzle_id = z.id
   WHERE z.is_active
   ORDER BY z.city_id, z.seat_index;
$$;

REVOKE EXECUTE ON FUNCTION public.get_camp_seats() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_camp_seats() TO authenticated;

-- ── 2 + 3. แก้ปริศนารายข้อ ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_upsert_puzzle(
  p_city_id smallint, p_seat_index smallint,
  p_title text, p_prompt text, p_hint text,
  p_answer text, p_secret_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_no_answer boolean := coalesce(btrim(p_answer), '') = '';
BEGIN
  IF NOT public.is_camp_admin() THEN RETURN jsonb_build_object('status','forbidden'); END IF;

  -- ล็อกแถวเมืองก่อน กันน้องตอบถูกพร้อมกับตอนที่โซ่กำลังถูกคำนวณใหม่
  PERFORM 1 FROM public.city_progress WHERE city_id = p_city_id FOR UPDATE;

  IF v_no_answer AND NOT EXISTS (
       SELECT 1 FROM public.puzzles WHERE city_id = p_city_id AND seat_index = p_seat_index) THEN
    RETURN jsonb_build_object('status','answer_required');
  END IF;

  INSERT INTO public.puzzles (city_id, seat_index, title, prompt, hint, answer_hash, secret_code)
  VALUES (p_city_id, p_seat_index, p_title, p_prompt, p_hint,
          public.hash_answer(p_answer), p_secret_code)
  ON CONFLICT (city_id, seat_index) DO UPDATE
    SET title       = EXCLUDED.title,
        prompt      = EXCLUDED.prompt,
        hint        = EXCLUDED.hint,
        -- ส่งคำตอบว่างมา = ไม่เปลี่ยนเฉลยเดิม
        answer_hash = CASE WHEN v_no_answer
                           THEN public.puzzles.answer_hash ELSE EXCLUDED.answer_hash END,
        secret_code = EXCLUDED.secret_code;

  PERFORM public.recompute_city_progress(p_city_id);

  INSERT INTO public.admin_audit (actor_id, action, payload)
  VALUES (v_uid, 'upsert_puzzle',
          jsonb_build_object('city_id', p_city_id, 'seat_index', p_seat_index,
                             'answer_changed', NOT v_no_answer));

  RETURN jsonb_build_object('status','ok');
END;
$$;
