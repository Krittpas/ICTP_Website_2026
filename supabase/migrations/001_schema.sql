-- ============================================================
-- ICTP CAMP 2026 "Cybering Saloon" — 001 โครงตาราง
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TYPE public.user_role    AS ENUM ('student', 'admin');
CREATE TYPE public.solve_source AS ENUM ('answer', 'admin');
CREATE TYPE public.unlock_mode  AS ENUM ('auto', 'manual');

-- ── เมือง 6 เมือง ───────────────────────────────────────────
CREATE TABLE public.cities (
  id         smallint     PRIMARY KEY CHECK (id BETWEEN 1 AND 6),
  slug       text         NOT NULL UNIQUE,
  name_th    text         NOT NULL,
  name_en    text         NOT NULL,
  blurb      text         NOT NULL DEFAULT '',
  map_x      numeric(5,2) NOT NULL,   -- % ความกว้างแผนที่
  map_y      numeric(5,2) NOT NULL,   -- % ความสูงแผนที่
  accent_hex text         NOT NULL DEFAULT '#D4A017',
  is_active  boolean      NOT NULL DEFAULT true
);

-- ── รายชื่อที่อนุญาตให้มีบัญชี ───────────────────────────────
CREATE TABLE public.roster (
  email              text     PRIMARY KEY,
  display_name       text     NOT NULL,
  nickname           text     NOT NULL DEFAULT '',
  intended_role      public.user_role NOT NULL DEFAULT 'student',
  city_id            smallint REFERENCES public.cities(id),
  seat_index         smallint CHECK (seat_index BETWEEN 1 AND 6),
  account_created_at timestamptz,
  UNIQUE (city_id, seat_index)
);

-- ── โปรไฟล์ผู้ใช้ ───────────────────────────────────────────
CREATE TABLE public.profiles (
  id           uuid     PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        text     NOT NULL UNIQUE,
  display_name text     NOT NULL DEFAULT '',
  nickname     text     NOT NULL DEFAULT '',
  avatar_url   text,
  role         public.user_role NOT NULL DEFAULT 'student',
  student_code text,
  city_id      smallint REFERENCES public.cities(id),
  seat_index   smallint CHECK (seat_index BETWEEN 1 AND 6),
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_display_name_length CHECK (char_length(display_name) <= 100)
);

-- หนึ่งที่นั่งมีเจ้าของได้คนเดียว
CREATE UNIQUE INDEX profiles_city_seat_uniq
  ON public.profiles (city_id, seat_index)
  WHERE city_id IS NOT NULL AND seat_index IS NOT NULL;

-- ── ปริศนา 36 ข้อ ───────────────────────────────────────────
-- answer_hash และ secret_code ไม่เคยถูกส่งออกจากฐานข้อมูล
-- นอกจากผ่าน RPC ที่ยืนยันแล้วว่าตอบถูก
CREATE TABLE public.puzzles (
  id          serial   PRIMARY KEY,
  city_id     smallint NOT NULL REFERENCES public.cities(id),
  seat_index  smallint NOT NULL CHECK (seat_index BETWEEN 1 AND 6),
  title       text     NOT NULL,
  prompt      text     NOT NULL DEFAULT '',
  hint        text     NOT NULL DEFAULT '',
  media_url   text,
  answer_hash text     NOT NULL,
  secret_code text     NOT NULL,
  is_active   boolean  NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (city_id, seat_index)
);

-- ── ที่นั่งที่ผ่านแล้ว ───────────────────────────────────────
-- UNIQUE(puzzle_id) คือตัวกันสองคนตอบถูกพร้อมกันแล้วโซ่เลื่อนสองครั้ง
CREATE TABLE public.puzzle_solves (
  id        bigserial PRIMARY KEY,
  puzzle_id integer   NOT NULL UNIQUE REFERENCES public.puzzles(id) ON DELETE CASCADE,
  user_id   uuid      NOT NULL REFERENCES public.profiles(id),
  via       public.solve_source NOT NULL DEFAULT 'answer',
  solved_at timestamptz NOT NULL DEFAULT now()
);

-- ── ความคืบหน้ารายเมือง (แหล่ง realtime + ตัวตัดสินประตูลูกโซ่) ──
CREATE TABLE public.city_progress (
  city_id        smallint PRIMARY KEY REFERENCES public.cities(id),
  current_seat   smallint NOT NULL DEFAULT 1,
  solved_count   smallint NOT NULL DEFAULT 0,
  last_solved_by uuid     REFERENCES public.profiles(id),
  last_solved_at timestamptz,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- ── บันทึกการส่งคำตอบ (audit + rate limit) ───────────────────
CREATE TABLE public.submissions (
  id           bigserial   PRIMARY KEY,
  user_id      uuid        NOT NULL REFERENCES public.profiles(id),
  puzzle_id    integer     NOT NULL REFERENCES public.puzzles(id) ON DELETE CASCADE,
  answer_text  text        NOT NULL,
  is_correct   boolean     NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_submissions_rate_limit
  ON public.submissions (user_id, puzzle_id, submitted_at);

-- ── สถานะทั้งค่าย (เปิดเผยได้ → เปิด realtime ได้) ────────────
CREATE TABLE public.camp_state (
  id                  integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  camp_open           boolean NOT NULL DEFAULT false,
  opens_at            timestamptz,
  decrypt_unlocked    boolean NOT NULL DEFAULT false,
  decrypt_unlock_mode public.unlock_mode,
  decrypt_unlocked_at timestamptz,
  decrypt_unlocked_by uuid REFERENCES public.profiles(id),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.camp_state (id) VALUES (1);

-- ── ความลับของด่านสุดท้าย (แยกตาราง ไม่มี policy ใด ๆ) ────────
CREATE TABLE public.camp_secrets (
  id           integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  final_prompt text NOT NULL DEFAULT '',
  final_hash   text,
  final_reward text NOT NULL DEFAULT ''
);
INSERT INTO public.camp_secrets (id) VALUES (1);

-- ── อีเมลพี่ค่าย ────────────────────────────────────────────
CREATE TABLE public.admin_emails (
  email      text PRIMARY KEY,
  note       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── ประกาศ ─────────────────────────────────────────────────
CREATE TABLE public.announcements (
  id                   bigserial   PRIMARY KEY,
  title                text        NOT NULL CHECK (char_length(title) <= 200),
  body                 text        NOT NULL CHECK (char_length(body)  <= 5000),
  creator_display_name text        NOT NULL DEFAULT '',
  created_by           uuid        REFERENCES public.profiles(id),
  created_at           timestamptz NOT NULL DEFAULT now(),
  published_at         timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz,
  updated_by           uuid        REFERENCES public.profiles(id),
  is_pinned            boolean     NOT NULL DEFAULT false
);
CREATE INDEX announcements_board_order
  ON public.announcements (is_pinned DESC, published_at DESC);

-- ── บันทึกการใช้สิทธิ์ของพี่ค่าย ─────────────────────────────
CREATE TABLE public.admin_audit (
  id         bigserial   PRIMARY KEY,
  actor_id   uuid        NOT NULL REFERENCES public.profiles(id),
  action     text        NOT NULL,
  payload    jsonb       NOT NULL DEFAULT '{}'::jsonb,
  reason     text,
  created_at timestamptz NOT NULL DEFAULT now()
);
