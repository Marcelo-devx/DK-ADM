-- Adiciona política para permitir que admins vejam todos os registros de uso de cupons
CREATE POLICY "Admins can view all user coupons" ON public.user_coupons 
FOR SELECT TO authenticated USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'adm'
);