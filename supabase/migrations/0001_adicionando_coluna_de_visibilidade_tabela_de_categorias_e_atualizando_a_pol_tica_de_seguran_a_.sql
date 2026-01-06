ALTER TABLE public.categories
ADD COLUMN is_visible BOOLEAN NOT NULL DEFAULT TRUE;

DROP POLICY IF EXISTS "Public categories are viewable by everyone." ON public.categories;

CREATE POLICY "Public categories are viewable by everyone."
ON public.categories FOR SELECT
USING (is_visible = true);