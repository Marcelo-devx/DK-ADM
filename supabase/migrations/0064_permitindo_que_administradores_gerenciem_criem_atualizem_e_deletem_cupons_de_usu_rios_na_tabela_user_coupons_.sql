-- Permitir que Admins INSERIAM cupons para qualquer usuário
CREATE POLICY "Admins can insert user coupons" ON public.user_coupons
FOR INSERT TO authenticated
WITH CHECK (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'adm'
);

-- Permitir que Admins ATUALIZEM cupons de qualquer usuário (ex: marcar como usado manualmente)
CREATE POLICY "Admins can update user coupons" ON public.user_coupons
FOR UPDATE TO authenticated
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'adm'
);

-- Permitir que Admins DELETEM cupons de qualquer usuário
CREATE POLICY "Admins can delete user coupons" ON public.user_coupons
FOR DELETE TO authenticated
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'adm'
);