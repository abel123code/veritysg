
-- Guide tactics (psychological tactics per phase)
CREATE TABLE public.guide_tactics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase text NOT NULL CHECK (phase IN ('viewing', 'negotiation', 'receipt')),
  question text NOT NULL DEFAULT '',
  answer text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.guide_tactics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read guide tactics"
  ON public.guide_tactics FOR SELECT
  TO anon, authenticated
  USING (true);

-- Guide regulations
CREATE TABLE public.guide_regulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.guide_regulations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read guide regulations"
  ON public.guide_regulations FOR SELECT
  TO anon, authenticated
  USING (true);

-- Guide glossary
CREATE TABLE public.guide_glossary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  term text NOT NULL DEFAULT '',
  definition text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.guide_glossary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read guide glossary"
  ON public.guide_glossary FOR SELECT
  TO anon, authenticated
  USING (true);
