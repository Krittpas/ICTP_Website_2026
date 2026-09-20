-- ============================================================
-- 016 ตารางพี่รหัสแยกเป็นของตัวเอง + รหัสลับสุ่ม 18 อักขระ
--
-- 1. รหัสลับประจำตัวไม่ต้องคิดเองอีกต่อไป — ระบบสุ่มให้ 18 อักขระ
--    ชุดอักขระตัดตัวที่อ่านสับสนออก (0/O/o · 1/l/I) เพราะน้องต้องพิมพ์ตามจากหน้าจอ
--    การันตีว่ามีครบทั้งพิมพ์ใหญ่ พิมพ์เล็ก ตัวเลข และอักขระพิเศษอย่างละอย่างน้อยหนึ่งตัว
-- 2. "พี่รหัส" กลายเป็นตารางของตัวเอง (public.seniors)
--    เดิมชื่อพี่กับคำใบ้ถูกเก็บซ้ำในแถวของน้องแต่ละคน พี่หนึ่งคนที่มีน้องสามคน
--    ต้องพิมพ์คำใบ้เดียวกันสามรอบ และแก้ทีหลังก็ต้องไล่แก้ทีละแถว
--    ตอนนี้คำใบ้ผูกกับพี่ — เลือกพี่แล้วใส่คำใบ้ครั้งเดียว น้องทุกคนของพี่คนนั้นเห็นตรงกัน
--    senior_matches เหลือหน้าที่เดียวคือบอกว่าน้องอีเมลไหนเป็นของพี่คนไหน
--
-- ข้อมูลเดิมถูกย้ายให้เอง — คู่ที่ตั้งไว้แล้วไม่หาย
-- รหัสลับของปริศนาที่มีอยู่แล้วไม่ถูกแตะ (สั่งสุ่มใหม่ได้จากปุ่มในหน้า /admin)
--
-- รันต่อจาก 015 ได้เลย
-- ============================================================

-- ============================================================
-- 1. รหัสลับสุ่ม
-- ============================================================

-- สุ่มหนึ่งตัวจากชุดอักขระ
-- ทิ้งค่าที่ล้นรอบแล้วสุ่มใหม่ ไม่อย่างนั้นตัวต้น ๆ ของชุดจะออกบ่อยกว่าตัวท้าย
CREATE OR REPLACE FUNCTION public.pick_random_char(p_alphabet text)
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_n     integer := length(p_alphabet);
  v_limit integer := 256 - (256 % v_n);
  v_byte  integer;
BEGIN
  LOOP
    v_byte := get_byte(extensions.gen_random_bytes(1), 0);
    EXIT WHEN v_byte < v_limit;
  END LOOP;
  RETURN substr(p_alphabet, (v_byte % v_n) + 1, 1);
END;
$fn$;

/*
 * รหัสลับประจำตัว 18 อักขระ
 *
 * ชุดอักขระตัด 0 O o 1 l I ออกทั้งหมด — น้องอ่านจากหน้าจอแล้วพิมพ์ตาม
 * ถ้าปล่อยตัวสับสนไว้ จะเสียเวลาทั้งคิวกับรหัสที่พิมพ์ถูกแล้วแต่ระบบบอกผิด
 * อักขระพิเศษเลือกเฉพาะตัวที่หาเจอง่ายบนแป้นพิมพ์ ไม่มี \ / ` ' " | ~ ^
 */
CREATE OR REPLACE FUNCTION public.generate_secret_code()
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_sets  constant text[] := ARRAY[
    'ABCDEFGHJKLMNPQRSTUVWXYZ',   -- ไม่มี I O
    'abcdefghijkmnpqrstuvwxyz',   -- ไม่มี l o
    '23456789',                   -- ไม่มี 0 1
    '!@#$%&*-_+=?'
  ];
  v_len   constant integer := 18;
  v_all   text := v_sets[1] || v_sets[2] || v_sets[3] || v_sets[4];
  v_chars text[] := '{}';
  v_set   text;
  v_i     integer;
  v_j     integer;
  v_tmp   text;
BEGIN
  -- อย่างละหนึ่งตัวก่อน กันรหัสที่บังเอิญออกมาไม่มีตัวเลขหรือไม่มีอักขระพิเศษเลย
  FOREACH v_set IN ARRAY v_sets LOOP
    v_chars := v_chars || public.pick_random_char(v_set);
  END LOOP;

  FOR v_i IN (array_length(v_sets, 1) + 1) .. v_len LOOP
    v_chars := v_chars || public.pick_random_char(v_all);
  END LOOP;

  -- สับตำแหน่ง ไม่อย่างนั้นสี่ตัวแรกจะเดาชนิดได้เสมอ
  FOR v_i IN REVERSE v_len .. 2 LOOP
    v_j := 1 + (get_byte(extensions.gen_random_bytes(1), 0) % v_i);
    v_tmp        := v_chars[v_i];
    v_chars[v_i] := v_chars[v_j];
    v_chars[v_j] := v_tmp;
  END LOOP;

  RETURN array_to_string(v_chars, '');
END;
$fn$;

-- ฟังก์ชันภายใน เรียกจาก RPC ของพี่ค่ายเท่านั้น
REVOKE EXECUTE ON FUNCTION public.pick_random_char(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_secret_code() FROM PUBLIC, anon, authenticated;

-- ============================================================
-- 2. ตารางพี่รหัส
-- ============================================================
CREATE TABLE IF NOT EXISTS public.seniors (
  id         bigserial   PRIMARY KEY,
  name       text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  nickname   text        NOT NULL DEFAULT '' CHECK (char_length(nickname) <= 50),
  clue       text        NOT NULL DEFAULT '' CHECK (char_length(clue) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ชื่อ + ชื่อเล่นซ้ำกันไม่ได้ เพื่อให้การวางจากสเปรดชีตหาพี่คนเดิมเจอแทนที่จะสร้างซ้ำ
CREATE UNIQUE INDEX IF NOT EXISTS seniors_identity_uniq
  ON public.seniors (lower(btrim(name)), lower(btrim(nickname)));

-- ไม่มี policy โดยตั้งใจ — เข้าถึงผ่าน RPC เท่านั้น เหมือน senior_matches
ALTER TABLE public.seniors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.seniors                 FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.seniors_id_seq FROM anon, authenticated;

ALTER TABLE public.senior_matches
  ADD COLUMN IF NOT EXISTS senior_id bigint REFERENCES public.seniors(id) ON DELETE RESTRICT;

-- ── ย้ายข้อมูลเดิม ────────────────────────────────────────────
-- ทั้งก้อนอยู่ในเงื่อนไข "ยังมีคอลัมน์เก่าอยู่" เพื่อให้รันไฟล์นี้ซ้ำได้โดยไม่พัง
DO $migrate$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'senior_matches' AND column_name = 'senior_name'
  ) THEN
    -- พี่คนเดียวกันที่ถูกพิมพ์ไว้หลายแถว ยุบเหลือแถวเดียว เอาคำใบ้ของแถวที่แก้ล่าสุด
    INSERT INTO public.seniors (name, nickname, clue)
    SELECT DISTINCT ON (lower(btrim(senior_name)), lower(btrim(coalesce(senior_nickname, ''))))
           btrim(senior_name),
           btrim(coalesce(senior_nickname, '')),
           btrim(coalesce(clue, ''))
      FROM public.senior_matches
     WHERE btrim(coalesce(senior_name, '')) <> ''
     ORDER BY lower(btrim(senior_name)),
              lower(btrim(coalesce(senior_nickname, ''))),
              updated_at DESC
    ON CONFLICT (lower(btrim(name)), lower(btrim(nickname))) DO NOTHING;

    UPDATE public.senior_matches m
       SET senior_id = s.id
      FROM public.seniors s
     WHERE m.senior_id IS NULL
       AND lower(btrim(m.senior_name))                   = lower(btrim(s.name))
       AND lower(btrim(coalesce(m.senior_nickname, ''))) = lower(btrim(s.nickname));

    -- แถวที่ไม่มีชื่อพี่เลยไม่เคยมีความหมาย น้องไม่เห็นอะไรอยู่แล้ว
    DELETE FROM public.senior_matches WHERE senior_id IS NULL;

    ALTER TABLE public.senior_matches
      DROP COLUMN senior_name,
      DROP COLUMN senior_nickname,
      DROP COLUMN clue;
  END IF;
END;
$migrate$;

ALTER TABLE public.senior_matches ALTER COLUMN senior_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS senior_matches_by_senior ON public.senior_matches (senior_id);

-- ============================================================
-- 3. ฝั่งน้อง — รูปร่าง JSON เหมือนเดิมทุกประการ หน้าเว็บไม่ต้องรู้ว่าโครงเปลี่ยน
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_senior()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_prof     public.profiles%ROWTYPE;
  v_name     text;
  v_nickname text;
  v_clue     text;
  v_revealed timestamptz;
  v_unlocked boolean;
BEGIN
  SELECT * INTO v_prof FROM public.profiles WHERE id = auth.uid();
  IF v_prof.id IS NULL THEN RETURN jsonb_build_object('status','unauthorized'); END IF;

  SELECT decrypt_unlocked INTO v_unlocked FROM public.camp_state WHERE id = 1;
  IF NOT coalesce(v_unlocked, false) THEN RETURN jsonb_build_object('status','locked'); END IF;

  IF v_prof.role = 'admin' THEN RETURN jsonb_build_object('status','admin'); END IF;

  SELECT s.name, s.nickname, s.clue, m.revealed_at
    INTO v_name, v_nickname, v_clue, v_revealed
    FROM public.senior_matches m
    JOIN public.seniors s ON s.id = m.senior_id
   WHERE m.student_email = lower(v_prof.email);

  IF v_revealed IS NOT NULL THEN
    RETURN jsonb_build_object('status','revealed',
      'senior_name', v_name,
      'senior_nickname', v_nickname,
      'clue', v_clue);
  END IF;

  RETURN jsonb_build_object('status','ready');
END;
$fn$;

CREATE OR REPLACE FUNCTION public.reveal_my_senior(p_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_uid      uuid := auth.uid();
  v_prof     public.profiles%ROWTYPE;
  v_puz      public.puzzles%ROWTYPE;
  v_senior   public.seniors%ROWTYPE;
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

  -- ไม่สนตัวพิมพ์เล็กใหญ่และช่องว่างหัวท้าย — เทียบกับรหัสของตัวเองข้อเดียว
  -- จึงไม่มีทางไปชนรหัสของคนอื่น และน้องไม่ต้องลุ้นเรื่องแคปส์ล็อกตอนพิมพ์ตาม
  v_ok := public.normalize_answer(p_code) = public.normalize_answer(v_puz.secret_code);

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

-- ============================================================
-- 4. ฝั่งพี่ค่าย — จัดการพี่รหัส
-- ============================================================

-- รายชื่อพี่รหัสทั้งหมด พร้อมจำนวนน้องที่จับคู่ไว้แล้ว
CREATE OR REPLACE FUNCTION public.admin_list_seniors()
RETURNS TABLE (
  id bigint, name text, nickname text, clue text,
  assigned integer, revealed integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
BEGIN
  IF NOT public.is_camp_admin() THEN RETURN; END IF;

  RETURN QUERY
  SELECT s.id, s.name, s.nickname, s.clue,
         count(m.student_email)::integer,
         count(m.revealed_at)::integer
    FROM public.seniors s
    LEFT JOIN public.senior_matches m ON m.senior_id = s.id
   GROUP BY s.id
   ORDER BY s.name, s.nickname;
END;
$fn$;

-- p_id NULL = สร้างพี่คนใหม่ · มีค่า = แก้พี่คนเดิม (รวมถึงคำใบ้)
CREATE OR REPLACE FUNCTION public.admin_upsert_senior(
  p_id bigint, p_name text, p_nickname text, p_clue text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_uid  uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_nick text := btrim(coalesce(p_nickname, ''));
  v_clue text := btrim(coalesce(p_clue, ''));
  v_id   bigint;
BEGIN
  IF NOT public.is_camp_admin() THEN RETURN jsonb_build_object('status','forbidden'); END IF;
  IF char_length(v_name) NOT BETWEEN 1 AND 100 THEN RETURN jsonb_build_object('status','name_required'); END IF;
  IF char_length(v_nick) > 50   THEN RETURN jsonb_build_object('status','nickname_too_long'); END IF;
  IF char_length(v_clue) > 1000 THEN RETURN jsonb_build_object('status','clue_too_long'); END IF;

  IF p_id IS NULL THEN
    -- ชื่อ+ชื่อเล่นตรงกับพี่ที่มีอยู่แล้ว = คนเดียวกัน ไม่สร้างซ้ำ
    -- ช่องคำใบ้ว่างถือว่า "ไม่ได้ตั้งใจจะลบ" จึงคงคำใบ้เดิมไว้
    INSERT INTO public.seniors (name, nickname, clue) VALUES (v_name, v_nick, v_clue)
    ON CONFLICT (lower(btrim(name)), lower(btrim(nickname))) DO UPDATE
      SET clue       = CASE WHEN EXCLUDED.clue = '' THEN public.seniors.clue ELSE EXCLUDED.clue END,
          updated_at = now()
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.seniors
       SET name = v_name, nickname = v_nick, clue = v_clue, updated_at = now()
     WHERE id = p_id
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN RETURN jsonb_build_object('status','senior_not_found'); END IF;
  END IF;

  INSERT INTO public.admin_audit (actor_id, action, payload)
  VALUES (v_uid, 'upsert_senior', jsonb_build_object('senior_id', v_id, 'name', v_name));

  RETURN jsonb_build_object('status','ok','senior_id', v_id);
EXCEPTION WHEN unique_violation THEN
  -- แก้ชื่อพี่คนหนึ่งให้ไปซ้ำกับพี่อีกคนที่มีอยู่แล้ว
  RETURN jsonb_build_object('status','duplicate_senior');
END;
$fn$;

-- ลบพี่รหัส — ปฏิเสธถ้ายังมีน้องผูกอยู่ เพื่อไม่ให้น้องหลุดคู่แบบเงียบ ๆ
CREATE OR REPLACE FUNCTION public.admin_delete_senior(p_id bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_uid   uuid := auth.uid();
  v_count integer;
BEGIN
  IF NOT public.is_camp_admin() THEN RETURN jsonb_build_object('status','forbidden'); END IF;

  SELECT count(*) INTO v_count FROM public.senior_matches WHERE senior_id = p_id;
  IF v_count > 0 THEN
    RETURN jsonb_build_object('status','senior_in_use','count', v_count);
  END IF;

  DELETE FROM public.seniors WHERE id = p_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','senior_not_found'); END IF;

  INSERT INTO public.admin_audit (actor_id, action, payload)
  VALUES (v_uid, 'delete_senior', jsonb_build_object('senior_id', p_id));

  RETURN jsonb_build_object('status','ok');
END;
$fn$;

-- ============================================================
-- 5. ฝั่งพี่ค่าย — จับคู่น้องเข้ากับพี่
-- ============================================================

-- น้องทุกคนในระบบ + พี่ที่จับคู่ไว้ (ถ้ามี)
DROP FUNCTION IF EXISTS public.admin_list_senior_matches();
CREATE OR REPLACE FUNCTION public.admin_list_senior_matches()
RETURNS TABLE (
  email text, display_name text, city_id smallint, seat_index smallint, has_account boolean,
  senior_id bigint, senior_name text, senior_nickname text, clue text, revealed_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
BEGIN
  IF NOT public.is_camp_admin() THEN RETURN; END IF;

  RETURN QUERY
  SELECT coalesce(lower(p.email), m.student_email),
         coalesce(p.display_name, ''),
         p.city_id, p.seat_index,
         p.id IS NOT NULL,
         s.id, s.name, s.nickname, s.clue, m.revealed_at
    FROM (SELECT * FROM public.profiles WHERE role = 'student') p
    FULL JOIN public.senior_matches m ON m.student_email = lower(p.email)
    LEFT JOIN public.seniors s        ON s.id = m.senior_id
   ORDER BY p.city_id NULLS LAST, p.seat_index NULLS LAST, 1;
END;
$fn$;

-- จับคู่น้องหนึ่งคนเข้ากับพี่ที่มีอยู่แล้ว — ใช้กับฟอร์ม "เลือกพี่รหัส" ในหน้า /admin
CREATE OR REPLACE FUNCTION public.admin_assign_senior(p_email text, p_senior_id bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_uid   uuid := auth.uid();
  v_email text := lower(btrim(coalesce(p_email, '')));
BEGIN
  IF NOT public.is_camp_admin() THEN RETURN jsonb_build_object('status','forbidden'); END IF;
  IF v_email !~ '^s[0-9]{5}@bj\.ac\.th$' THEN RETURN jsonb_build_object('status','invalid_email'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.seniors WHERE id = p_senior_id) THEN
    RETURN jsonb_build_object('status','senior_not_found');
  END IF;

  INSERT INTO public.senior_matches (student_email, senior_id)
  VALUES (v_email, p_senior_id)
  ON CONFLICT (student_email) DO UPDATE
    SET senior_id = EXCLUDED.senior_id, updated_at = now();

  INSERT INTO public.admin_audit (actor_id, action, payload)
  VALUES (v_uid, 'assign_senior', jsonb_build_object('email', v_email, 'senior_id', p_senior_id));

  RETURN jsonb_build_object('status','ok');
END;
$fn$;

/*
 * วางจากสเปรดชีต — [{line, email, name, nickname, clue}, ...]
 *
 * ทำสองอย่างในทรานแซกชันเดียว: สร้าง/อัปเดตพี่ตามชื่อ+ชื่อเล่น แล้วผูกน้องเข้ากับพี่คนนั้น
 * ช่องคำใบ้ว่าง = ไม่แตะคำใบ้เดิมของพี่ (จะได้วางทับเพื่อแก้เฉพาะการจับคู่ได้)
 * แถวไหนผิดแม้แถวเดียว = ไม่บันทึกเลยสักแถว แล้วบอกเลขบรรทัดที่ผิดกลับไป
 */
CREATE OR REPLACE FUNCTION public.admin_upsert_senior_matches(p_rows jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_uid       uuid := auth.uid();
  v_bad       jsonb;
  v_count     integer;
  v_seniors   integer;
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

  -- พี่ก่อน — ชื่อ+ชื่อเล่นซ้ำในก้อนเดียวถือเป็นคนเดียวกัน เอาคำใบ้ของแถวหลังสุดที่ไม่ว่าง
  WITH src AS (
    SELECT btrim(r->>'name')                    AS name,
           btrim(coalesce(r->>'nickname', ''))  AS nickname,
           btrim(coalesce(r->>'clue', ''))      AS clue,
           n
      FROM jsonb_array_elements(p_rows) WITH ORDINALITY AS t(r, n)
  ), picked AS (
    SELECT DISTINCT ON (lower(name), lower(nickname)) name, nickname, clue
      FROM src
     ORDER BY lower(name), lower(nickname), (clue <> '') DESC, n DESC
  )
  INSERT INTO public.seniors (name, nickname, clue)
  SELECT name, nickname, clue FROM picked
  ON CONFLICT (lower(btrim(name)), lower(btrim(nickname))) DO UPDATE
    SET clue       = CASE WHEN EXCLUDED.clue = '' THEN public.seniors.clue ELSE EXCLUDED.clue END,
        updated_at = now();

  GET DIAGNOSTICS v_seniors = ROW_COUNT;

  -- แล้วค่อยผูกน้อง — อีเมลซ้ำในก้อนเดียว เอาแถวหลังสุด
  WITH src AS (
    SELECT lower(btrim(r->>'email'))            AS email,
           btrim(r->>'name')                    AS name,
           btrim(coalesce(r->>'nickname', ''))  AS nickname,
           n
      FROM jsonb_array_elements(p_rows) WITH ORDINALITY AS t(r, n)
  ), picked AS (
    SELECT DISTINCT ON (email) email, name, nickname
      FROM src ORDER BY email, n DESC
  )
  INSERT INTO public.senior_matches (student_email, senior_id)
  SELECT picked.email, s.id
    FROM picked
    JOIN public.seniors s
      ON lower(btrim(s.name)) = lower(picked.name)
     AND lower(btrim(s.nickname)) = lower(picked.nickname)
  ON CONFLICT (student_email) DO UPDATE
    SET senior_id = EXCLUDED.senior_id, updated_at = now();

  GET DIAGNOSTICS v_count = ROW_COUNT;

  INSERT INTO public.admin_audit (actor_id, action, payload)
  VALUES (v_uid, 'upsert_senior_matches',
          jsonb_build_object('count', v_count, 'seniors', v_seniors));

  RETURN jsonb_build_object('status','ok','count', v_count, 'seniors', v_seniors);
END;
$fn$;

-- ============================================================
-- 6. ฝั่งพี่ค่าย — สุ่มรหัสลับของปริศนา
-- ============================================================

/*
 * p_secret_code: NULL = ข้อใหม่ให้สุ่มให้ · ข้อเดิมไม่เปลี่ยน
 *                ''   = สุ่มรหัสใหม่ทับของเดิม
 *                อื่น = ใช้ค่านี้ (พี่ค่ายพิมพ์เองผ่าน SQL ได้อยู่ ถ้าอยากได้รหัสที่จำง่าย)
 * p_media_url  : ความหมายเดิมจาก 012 ไม่เปลี่ยน
 */
CREATE OR REPLACE FUNCTION public.admin_upsert_puzzle(
  p_city_id smallint, p_seat_index smallint,
  p_title text, p_prompt text, p_hint text,
  p_answer text, p_secret_code text,
  p_media_url text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_uid       uuid := auth.uid();
  v_no_answer boolean := coalesce(btrim(p_answer), '') = '';
  v_exists    boolean;
  v_old_media text;
  v_old_code  text;
  v_media     text;
  v_code      text;
BEGIN
  IF NOT public.is_camp_admin() THEN RETURN jsonb_build_object('status','forbidden'); END IF;

  IF p_media_url IS NOT NULL AND p_media_url <> ''
     AND p_media_url !~ '^[0-9a-f-]{36}/file(\.[a-z0-9]{1,8})?$' THEN
    RETURN jsonb_build_object('status','invalid_media');
  END IF;

  IF p_secret_code IS NOT NULL AND p_secret_code <> ''
     AND char_length(btrim(p_secret_code)) > 100 THEN
    RETURN jsonb_build_object('status','invalid_code');
  END IF;

  -- ล็อกแถวเมืองก่อน กันน้องตอบถูกพร้อมกับตอนที่โซ่กำลังถูกคำนวณใหม่
  PERFORM 1 FROM public.city_progress WHERE city_id = p_city_id FOR UPDATE;

  SELECT media_url, secret_code INTO v_old_media, v_old_code
    FROM public.puzzles WHERE city_id = p_city_id AND seat_index = p_seat_index;
  v_exists := FOUND;

  IF NOT v_exists AND v_no_answer THEN
    RETURN jsonb_build_object('status','answer_required');
  END IF;

  v_media := CASE WHEN p_media_url IS NULL THEN v_old_media
                  ELSE nullif(p_media_url, '') END;

  v_code := CASE
    WHEN p_secret_code IS NULL AND v_exists THEN v_old_code       -- ไม่ส่งมา = ไม่เปลี่ยน
    WHEN coalesce(btrim(p_secret_code), '') = '' THEN public.generate_secret_code()
    ELSE btrim(p_secret_code)
  END;

  INSERT INTO public.puzzles (city_id, seat_index, title, prompt, hint, media_url, answer_hash, secret_code)
  VALUES (p_city_id, p_seat_index, p_title, coalesce(p_prompt, ''), coalesce(p_hint, ''), v_media,
          public.hash_answer(p_answer), v_code)
  ON CONFLICT (city_id, seat_index) DO UPDATE
    SET title       = EXCLUDED.title,
        prompt      = EXCLUDED.prompt,
        hint        = EXCLUDED.hint,
        media_url   = EXCLUDED.media_url,
        -- ส่งคำตอบว่างมา = ไม่เปลี่ยนเฉลยเดิม
        answer_hash = CASE WHEN v_no_answer
                           THEN public.puzzles.answer_hash ELSE EXCLUDED.answer_hash END,
        secret_code = EXCLUDED.secret_code;

  PERFORM public.recompute_city_progress(p_city_id);

  INSERT INTO public.admin_audit (actor_id, action, payload)
  VALUES (v_uid, 'upsert_puzzle',
          jsonb_build_object('city_id', p_city_id, 'seat_index', p_seat_index,
                             'answer_changed', NOT v_no_answer,
                             'media_changed', v_media IS DISTINCT FROM v_old_media,
                             'code_changed',  v_code  IS DISTINCT FROM v_old_code));

  -- รูปเก่าที่ไม่ถูกใช้แล้ว ให้หน้าเว็บลบออกจาก Storage
  RETURN jsonb_build_object('status','ok',
    'secret_code', v_code,
    'replaced_media', CASE WHEN v_old_media IS DISTINCT FROM v_media THEN v_old_media END);
END;
$fn$;

/*
 * สุ่มรหัสลับใหม่ให้ทุกข้อรวดเดียว — ใช้ตอนตั้งค่าครั้งแรกเพื่อทิ้งรหัสตัวอย่างจาก seed
 * ข้อที่มีคนไขผ่านไปแล้วจะถูกข้าม เพราะน้องจดรหัสเดิมไปแล้วและต้องใช้กับเครื่องถอดรหัส
 */
CREATE OR REPLACE FUNCTION public.admin_regenerate_secret_codes(p_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE
  v_uid     uuid := auth.uid();
  v_changed integer := 0;
  v_skipped integer;
  r         record;
BEGIN
  IF NOT public.is_camp_admin() THEN RETURN jsonb_build_object('status','forbidden'); END IF;

  FOR r IN
    SELECT z.id FROM public.puzzles z
     WHERE NOT EXISTS (SELECT 1 FROM public.puzzle_solves s WHERE s.puzzle_id = z.id)
     ORDER BY z.city_id, z.seat_index
  LOOP
    UPDATE public.puzzles SET secret_code = public.generate_secret_code() WHERE id = r.id;
    v_changed := v_changed + 1;
  END LOOP;

  SELECT count(*) INTO v_skipped FROM public.puzzle_solves;

  INSERT INTO public.admin_audit (actor_id, action, payload, reason)
  VALUES (v_uid, 'regenerate_secret_codes',
          jsonb_build_object('changed', v_changed, 'skipped', v_skipped), p_reason);

  RETURN jsonb_build_object('status','ok','changed', v_changed, 'skipped', v_skipped);
END;
$fn$;

-- ============================================================
-- 7. สิทธิ์ — ค่าเริ่มต้นของ Postgres/Supabase ให้ PUBLIC และ anon เรียกได้ ต้องถอนเอง
-- ============================================================
REVOKE EXECUTE ON FUNCTION
  public.get_my_senior(),
  public.reveal_my_senior(text),
  public.admin_list_seniors(),
  public.admin_upsert_senior(bigint, text, text, text),
  public.admin_delete_senior(bigint),
  public.admin_list_senior_matches(),
  public.admin_assign_senior(text, bigint),
  public.admin_upsert_senior_matches(jsonb),
  public.admin_upsert_puzzle(smallint, smallint, text, text, text, text, text, text),
  public.admin_regenerate_secret_codes(text)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.get_my_senior(),
  public.reveal_my_senior(text),
  public.admin_list_seniors(),
  public.admin_upsert_senior(bigint, text, text, text),
  public.admin_delete_senior(bigint),
  public.admin_list_senior_matches(),
  public.admin_assign_senior(text, bigint),
  public.admin_upsert_senior_matches(jsonb),
  public.admin_upsert_puzzle(smallint, smallint, text, text, text, text, text, text),
  public.admin_regenerate_secret_codes(text)
TO authenticated;
