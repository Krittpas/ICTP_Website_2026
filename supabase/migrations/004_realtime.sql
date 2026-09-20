-- ============================================================
-- 004 Realtime — กระจายความคืบหน้าให้ทุกเครื่องเห็นพร้อมกัน
-- ทั้งสองตารางเปิดให้อ่านได้อยู่แล้ว จึงปลอดภัยที่จะ broadcast
-- ============================================================
ALTER TABLE public.city_progress REPLICA IDENTITY FULL;
ALTER TABLE public.camp_state    REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.city_progress;
ALTER PUBLICATION supabase_realtime ADD TABLE public.camp_state;
