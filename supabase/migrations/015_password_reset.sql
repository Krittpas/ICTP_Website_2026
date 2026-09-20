-- ============================================================
-- 015 พี่ค่ายออกรหัสผ่านใหม่ให้น้องได้จากหน้า /admin
--
-- การตั้งรหัสผ่านจริงต้องใช้ service role ซึ่งอยู่ฝั่ง server เท่านั้น
-- ฟังก์ชันนี้เป็นด่านตัดสินสิทธิ์และเป็นที่บันทึกประวัติ:
--   ผู้เรียกต้องเป็นพี่ค่าย · เป้าหมายต้องเป็นน้องค่าย (กันรีเซ็ตรหัสของพี่ค่ายด้วยกันเอง)
-- แล้วคืน user id ให้ฝั่ง server เอาไปตั้งรหัสใหม่
--
-- รันต่อจาก 014 ได้เลย
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_begin_password_reset(p_email text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_target public.profiles%ROWTYPE;
BEGIN
  IF NOT public.is_camp_admin() THEN RETURN jsonb_build_object('status','forbidden'); END IF;

  SELECT * INTO v_target FROM public.profiles WHERE lower(email) = lower(btrim(p_email));
  IF v_target.id IS NULL THEN RETURN jsonb_build_object('status','student_not_found'); END IF;
  IF v_target.role <> 'student' THEN RETURN jsonb_build_object('status','not_a_student'); END IF;

  INSERT INTO public.admin_audit (actor_id, action, payload)
  VALUES (v_uid, 'reset_password', jsonb_build_object('email', lower(v_target.email)));

  RETURN jsonb_build_object('status','ok','user_id', v_target.id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_begin_password_reset(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_begin_password_reset(text) TO authenticated;
