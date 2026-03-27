
CREATE TABLE public.tool_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tool_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read tool settings"
ON public.tool_settings
FOR SELECT
TO anon, authenticated
USING (true);

-- Seed default rows
INSERT INTO public.tool_settings (key, value) VALUES
  ('deal_thresholds_buy', '{"great": {"maxRatio": 0.9, "score": 90}, "good": {"maxRatio": 0.97, "score": 70}, "fair": {"maxRatio": 1.05, "score": 50}, "bad": {"score": 20}}'::jsonb),
  ('deal_thresholds_rent', '{"great": {"maxRatio": 0.9, "score": 90}, "good": {"maxRatio": 0.97, "score": 70}, "fair": {"maxRatio": 1.05, "score": 50}, "bad": {"score": 20}}'::jsonb),
  ('location_aliases', '[{"alias": "Pinnacle at Duxton", "street": "CANTONMENT RD", "town": "BUKIT MERAH"}, {"alias": "SkyVille@Dawson", "street": "DAWSON RD", "town": "QUEENSTOWN"}]'::jsonb),
  ('price_diff_messages', '{"buy_over": "${amount} over what you should be paying", "buy_under": "${amount} under market value", "rent_over": "${amount} over what you should be paying for rent", "rent_under": "${amount} under market rent — a good deal!"}'::jsonb);
