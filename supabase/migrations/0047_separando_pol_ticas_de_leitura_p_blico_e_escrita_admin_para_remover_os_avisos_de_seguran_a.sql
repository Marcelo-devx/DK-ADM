-- 1. APP SETTINGS
DROP POLICY IF EXISTS "Optimized access for app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Public read settings" ON public.app_settings;

CREATE POLICY "Public read settings" ON public.app_settings
FOR SELECT USING (true);

CREATE POLICY "Admin write settings" ON public.app_settings
FOR ALL 
TO authenticated
USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'adm')
WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'adm');


-- 2. HERO SLIDES
DROP POLICY IF EXISTS "Optimized access for hero_slides" ON public.hero_slides;

CREATE POLICY "Public read hero_slides" ON public.hero_slides
FOR SELECT USING (true);

CREATE POLICY "Admin write hero_slides" ON public.hero_slides
FOR ALL 
TO authenticated
USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'adm')
WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'adm');


-- 3. PRODUCTS
DROP POLICY IF EXISTS "Optimized access for products" ON public.products;

CREATE POLICY "Public read products" ON public.products
FOR SELECT USING (true);

CREATE POLICY "Admin write products" ON public.products
FOR ALL 
TO authenticated
USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'adm')
WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'adm');