-- ============================================================
-- 003 Row Level Security + สิทธิ์ระดับคอลัมน์
--
-- หลัก: ตารางที่มีความลับไม่มี SELECT policy เลย เข้าถึงผ่าน RPC เท่านั้น
-- ============================================================
ALTER TABLE public.cities        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roster        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.puzzles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.puzzle_solves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.city_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.camp_state    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.camp_secrets  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_emails  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit   ENABLE ROW LEVEL SECURITY;

-- puzzles · camp_secrets · admin_emails : ไม่มี policy โดยตั้งใจ
-- ถึงจะยิง PostgREST ตรงก็ไม่ได้อะไรกลับไป

-- ── อ่านได้ทุกคน ────────────────────────────────────────────
CREATE POLICY "read cities"        ON public.cities        FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "read camp state"    ON public.camp_state    FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "read city progress" ON public.city_progress FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "read announcements" ON public.announcements FOR SELECT TO anon, authenticated USING (true);

-- ── โปรไฟล์ ────────────────────────────────────────────────
-- เห็นของตัวเอง และเห็นเพื่อนร่วมเมือง (หน้าแผนที่ต้องโชว์ชื่อ 6 ที่นั่ง)
CREATE POLICY "read own or same city profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR (city_id IS NOT NULL AND city_id = public.my_city_id())
    OR public.is_camp_admin()
  );

CREATE POLICY "update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- ── ผลงานของตัวเอง ─────────────────────────────────────────
CREATE POLICY "read own solves"
  ON public.puzzle_solves FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_camp_admin());

CREATE POLICY "read own submissions"
  ON public.submissions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_camp_admin());

-- ── ประกาศ: พี่ค่ายเขียน/แก้/ลบ ─────────────────────────────
CREATE POLICY "admin insert announcements"
  ON public.announcements FOR INSERT TO authenticated WITH CHECK (public.is_camp_admin());
CREATE POLICY "admin update announcements"
  ON public.announcements FOR UPDATE TO authenticated
  USING (public.is_camp_admin()) WITH CHECK (public.is_camp_admin());
CREATE POLICY "admin delete announcements"
  ON public.announcements FOR DELETE TO authenticated USING (public.is_camp_admin());

-- ── บันทึกการใช้สิทธิ์: พี่ค่ายอ่านอย่างเดียว ────────────────
CREATE POLICY "admin read audit"
  ON public.admin_audit FOR SELECT TO authenticated USING (public.is_camp_admin());

-- ── รายชื่อ: พี่ค่ายเท่านั้น ─────────────────────────────────
CREATE POLICY "admin read roster"
  ON public.roster FOR SELECT TO authenticated USING (public.is_camp_admin());

-- ============================================================
-- สิทธิ์ระดับคอลัมน์ — ด่านที่ไม่พึ่ง trigger
--
-- RLS ตัดสินว่า "แถวไหน" แต่ไม่ได้ตัดสินว่า "คอลัมน์ไหน"
-- ถ้าไม่ถอนสิทธิ์ตรงนี้ นักเรียนจะ UPDATE role ของตัวเองได้
-- ============================================================
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

GRANT SELECT ON public.cities, public.camp_state, public.city_progress,
                public.announcements TO anon, authenticated;
GRANT SELECT ON public.profiles, public.puzzle_solves, public.submissions,
                public.admin_audit, public.roster TO authenticated;

-- ผู้ใช้แก้ได้แค่ชื่อกับรูปของตัวเอง
GRANT UPDATE (display_name, nickname, avatar_url) ON public.profiles TO authenticated;

-- ประกาศ: แก้เนื้อหาได้ แต่ created_by แก้ไม่ได้ หลักฐานว่าใครโพสต์ต้องคงอยู่
GRANT INSERT, DELETE ON public.announcements TO authenticated;
GRANT UPDATE (title, body, is_pinned) ON public.announcements TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.announcements_id_seq TO authenticated;

-- เรียก RPC ได้ แต่ทุกตัวตรวจสิทธิ์ของตัวเองข้างใน
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
REVOKE EXECUTE ON FUNCTION public.hash_answer(text)      FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.normalize_answer(text) FROM anon, authenticated;
