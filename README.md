# ICTP CAMP 2026 — Cybering Saloon

เว็บค่ายของสายการเรียน ICTP ปี 2026 ธีมคาวบอยชายแดนผสมไซเบอร์
น้อง 36 คนถูกจัดลง 6 เมือง เมืองละ 6 ที่นั่ง ไขปริศนาต่อกันเป็นลูกโซ่
เพื่อรวมรหัสลับให้ครบแล้วเปิดเครื่องถอดรหัสหาพี่รหัสของตัวเอง

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Supabase (Postgres + Auth + Realtime) · next-themes

รองรับโทนมืดและโทนสว่าง สลับได้จากปุ่มบนแถบนำทาง ค่าเริ่มต้นเป็นโทนมืด

## เริ่มใช้งาน

```bash
npm install
cp .env.example .env.local     # เติมค่าจาก Supabase → Project Settings → API
npm run dev                    # http://localhost:3000
```

ก่อนใช้งานจริงต้องตั้งค่าฐานข้อมูลก่อน — ดู `SETUP.md`

### เพิ่มภาพบรรยากาศบนหน้าแรก

วางรูปไว้ที่ `public/gallery/` แล้วเพิ่มหนึ่งบรรทัดใน `src/content/gallery.ts`
เช่น `{ src: '/gallery/2025-opening.webp', caption: 'พิธีเปิดค่าย', year: '2025' }`
ยังไม่มีรูป = หน้าแรกแสดงกรอบ "เร็ว ๆ นี้" แทน

## โครงสร้าง

```
src/
├ app/
│  ├ page.tsx              หน้าแรกสาธารณะ
│  ├ (auth)/login/         เข้าสู่ระบบ
│  └ (app)/                ต้องล็อกอิน
│     ├ camp/              หน้าแรกค่าย (ล็อก/นับถอยหลังตาม camp_state)
│     ├ senior/            ตามหาพี่รหัส — announcements · puzzles (รวมภาพรวมค่าย) · decrypt
│     ├ decrypt/           เส้นทางเดิม เด้งไป /senior/decrypt
│     └ admin/             แผงควบคุมพี่ค่าย
├ actions/                 server actions — ตรวจรูปแบบแล้วส่งต่อให้ RPC
├ components/              landing · camp · puzzle · announcements · admin · decrypt · layout
├ content/gallery.ts       รายการภาพบรรยากาศค่ายปีก่อน ๆ บนหน้าแรก
├ lib/                     supabase · auth (DAL) · camp state
└ types/app.ts
public/                    hero-banner.svg (ย่อจาก "ICTP banner 2026.svg" โดยแปลงรูปข้างในเป็น WebP) · logo-ictp.webp · gallery/
supabase/migrations/       001 → 016
```

## หลักความปลอดภัย 5 ข้อ

1. เฉลยและรหัสลับไม่เคยออกจากฐานข้อมูล นอกจากตอบถูกแล้วเท่านั้น
   ตาราง `puzzles` · `camp_secrets` · `seniors` · `senior_matches` ไม่มี SELECT policy เลย
2. ทุก mutation ผ่าน RPC ที่อ่าน `auth.uid()` เอง ไม่เชื่อ id ที่ client ส่งมา
3. `role` อ่านจากฐานข้อมูลทุกครั้ง ผ่าน `getUser()` ไม่ใช่ `getSession()`
   (getSession อ่าน cookie โดยไม่ตรวจลายเซ็น JWT)
4. การใช้สิทธิ์ของพี่ค่ายทุกครั้งเขียนลง `admin_audit` ในทรานแซกชันเดียวกัน
5. สิทธิ์ระดับคอลัมน์กันการยกระดับสิทธิ์ ไม่พึ่ง trigger อย่างเดียว

## หมายเหตุเรื่อง middleware

Next.js 16 เปลี่ยนชื่อ `middleware` เป็น `proxy` และถือว่าชื่อเดิม deprecated แล้ว
โปรเจกต์นี้ยังใช้ `middleware.ts` เพราะ Vercel เคย deploy `proxy.ts` ไม่ผ่าน
เมื่อรองรับแล้วเปลี่ยนได้โดยเปลี่ยนชื่อไฟล์และชื่อฟังก์ชันเป็น `proxy` เท่านั้น
