ALTER TABLE public.room_images 
  ADD COLUMN title text NOT NULL DEFAULT '',
  ADD COLUMN tactics_label text NOT NULL DEFAULT '';