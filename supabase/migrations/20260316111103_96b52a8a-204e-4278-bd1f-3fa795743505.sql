ALTER TABLE public.room_images ADD COLUMN mobile_image_url text NOT NULL DEFAULT '';
ALTER TABLE public.room_hotspots ADD COLUMN mobile_x_percent numeric;
ALTER TABLE public.room_hotspots ADD COLUMN mobile_y_percent numeric;