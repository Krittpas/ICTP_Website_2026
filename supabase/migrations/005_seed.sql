-- ============================================================
-- 005 ข้อมูลตั้งต้น — 6 เมือง, ความคืบหน้าเริ่มต้น, ปริศนา 36 ข้อ
--
-- ปริศนาเป็นตัวอย่างไว้ทดสอบระบบให้เดินได้ครบวง
-- ก่อนใช้งานจริงให้แทนที่ด้วยโจทย์จริงผ่านหน้า /admin (ส่วนคลังปริศนา)
-- ============================================================
INSERT INTO public.cities (id, slug, name_th, name_en, blurb, map_x, map_y, accent_hex) VALUES
  (1,'pine-hollow','ไพน์ฮอลโลว์','Pine Hollow','โบสถ์ไม้กลางดงสนที่ระฆังยังตีเองได้',      11.00, 22.00, '#6FBF8E'),
  (2,'canvas-camp','แคนวาสแคมป์','Canvas Camp','ค่ายผ้าใบของพวกเดินทาง ไฟกองยังไม่เคยดับ',  41.00, 12.00, '#E0A24A'),
  (3,'still-lake','สทิลเลค','Still Lake','ทะเลสาบที่นิ่งจนสะท้อนสิ่งที่ยังไม่เกิด',           76.00, 20.00, '#5FB8D6'),
  (4,'main-street','เมนสตรีท','Main Street','ถนนสายเดียวที่มีทั้งซาลูนและสายโทรเลขเก่า',     9.00, 58.00, '#D4A017'),
  (5,'mesa-grande','เมซากรานเด','Mesa Grande','หน้าผาหินแดงกับบ้านดินที่ซ้อนกันเป็นชั้น',    44.00, 54.00, '#C97B5A'),
  (6,'adobe-flats','อะโดบีแฟลตส์','Adobe Flats','ที่ราบกระบองเพชรที่ลมพัดทรายมาปิดรอยเท้า',  70.00, 70.00, '#B98BD9');

INSERT INTO public.city_progress (city_id) SELECT id FROM public.cities;

-- ปริศนาตัวอย่าง: คำตอบของเมือง C ที่นั่ง S คือ "ictp-C-S"
INSERT INTO public.puzzles (city_id, seat_index, title, prompt, hint, answer_hash, secret_code)
SELECT c.id, s.seat,
       'ด่านที่ ' || s.seat || ' — ' || c.name_th,
       'โจทย์ตัวอย่างสำหรับทดสอบระบบ ให้ตอบว่า ictp-' || c.id || '-' || s.seat
         || ' (พี่ค่ายแทนที่ด้วยโจทย์จริงได้ที่หน้า /admin)',
       'คำใบ้จะถูกใส่ภายหลัง',
       public.hash_answer('ictp-' || c.id || '-' || s.seat),
       upper(c.slug) || '-' || lpad(s.seat::text, 2, '0')
  FROM public.cities c CROSS JOIN generate_series(1, 6) AS s(seat);

UPDATE public.camp_secrets
   SET final_prompt = 'นำรหัสลับทั้ง 36 ชิ้นมาเรียงตามเมืองและที่นั่ง แล้วอ่านตัวอักษรแรกของแต่ละชิ้น',
       final_hash   = public.hash_answer('cybering saloon'),
       final_reward = 'ยินดีด้วย พี่รหัสของพวกเธอกำลังรออยู่ที่หน้าซาลูน'
 WHERE id = 1;
