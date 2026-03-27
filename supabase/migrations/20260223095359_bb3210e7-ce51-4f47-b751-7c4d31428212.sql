
-- Create room_images table
CREATE TABLE public.room_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_key TEXT NOT NULL UNIQUE,
  image_url TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.room_images ENABLE ROW LEVEL SECURITY;

-- Public read
CREATE POLICY "Anyone can read room images"
ON public.room_images FOR SELECT USING (true);

-- Create storage bucket for room images
INSERT INTO storage.buckets (id, name, public) VALUES ('room-images', 'room-images', true);

-- Allow anyone to read from the bucket
CREATE POLICY "Public read room images" ON storage.objects FOR SELECT USING (bucket_id = 'room-images');

-- Allow uploads (authenticated or anon - admin handles auth via password)
CREATE POLICY "Allow upload room images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'room-images');

-- Allow overwrite
CREATE POLICY "Allow update room images" ON storage.objects FOR UPDATE USING (bucket_id = 'room-images');

-- Allow delete
CREATE POLICY "Allow delete room images" ON storage.objects FOR DELETE USING (bucket_id = 'room-images');
