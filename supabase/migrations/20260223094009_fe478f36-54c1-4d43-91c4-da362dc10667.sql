
CREATE TABLE public.room_hotspots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_key text NOT NULL,
  x_percent numeric NOT NULL DEFAULT 50,
  y_percent numeric NOT NULL DEFAULT 50,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.room_hotspots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read room hotspots"
ON public.room_hotspots
FOR SELECT
USING (true);
