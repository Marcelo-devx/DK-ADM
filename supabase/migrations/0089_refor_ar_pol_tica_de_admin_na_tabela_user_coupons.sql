-- Remove política antiga se existir para evitar conflitos
DROP POLICY IF EXISTS "Admins have full access to user coupons" ON public.user_coupons;

-- Cria política garantindo acesso total a admins
CREATE POLICY "Admins have full access to user coupons" 
ON public.user_coupons 
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() AND profiles.role = 'adm'
  )
);