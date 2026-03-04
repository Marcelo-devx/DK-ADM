-- Drop the overly permissive public read policy on app_settings
DROP POLICY IF EXISTS "Public read settings" ON public.app_settings;

-- Create a new policy that allows public read access ONLY to safe, non-secret keys.
-- This is necessary for features like the site logo (favicon) to work for all users.
CREATE POLICY "Public can read safe settings" ON public.app_settings
FOR SELECT
USING (key IN (
  'logo_url', 
  'site_url', 
  'sales_popup_interval'
));

-- The existing "Admin write settings" policy already grants admins full read access, so no changes are needed for admins.