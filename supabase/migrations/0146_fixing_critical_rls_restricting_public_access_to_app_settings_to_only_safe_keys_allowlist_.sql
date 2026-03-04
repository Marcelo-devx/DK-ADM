-- 1. Drop the insecure "allow all" select policy
DROP POLICY IF EXISTS "Public read settings" ON public.app_settings;

-- 2. Create a secure policy that only allows reading specific non-sensitive keys
-- This ensures API tokens and secrets remain hidden from anonymous users
CREATE POLICY "Public read safe settings" ON public.app_settings
FOR SELECT
USING (
  key IN ('logo_url', 'site_url', 'sales_popup_interval')
);

-- 3. Ensure Admins still have full access (Explicitly)
-- Note: There is likely already an admin policy, but we ensure one exists for SELECT to be safe
-- If "Admin write settings" covers ALL (*) operations, this is redundant but harmless.
-- If it only covered INSERT/UPDATE/DELETE, this ensures they can also SELECT.
DROP POLICY IF EXISTS "Admins full access settings" ON public.app_settings;

CREATE POLICY "Admins full access settings" ON public.app_settings
FOR ALL
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'adm'
)
WITH CHECK (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'adm'
);