-- Remove política antiga se existir
DROP POLICY IF EXISTS "Admins have full access to user coupons" ON public.user_coupons;

-- Cria política garantindo acesso total a admins
CREATE POLICY "Admins have full access to user coupons" 
ON public.user_coupons 
FOR ALL 
TO authenticated 
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'adm'
);