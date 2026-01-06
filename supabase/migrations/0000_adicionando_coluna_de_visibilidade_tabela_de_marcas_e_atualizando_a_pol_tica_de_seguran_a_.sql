ALTER TABLE public.brands
ADD COLUMN is_visible BOOLEAN NOT NULL DEFAULT TRUE;

DROP POLICY IF EXISTS "Public can view brands" ON public.brands;

CREATE POLICY "Public can view visible brands"
ON public.brands FOR SELECT
USING (is_visible = true);