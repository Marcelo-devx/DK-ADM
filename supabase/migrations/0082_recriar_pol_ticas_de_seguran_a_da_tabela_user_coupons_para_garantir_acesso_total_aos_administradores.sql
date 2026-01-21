-- Remover políticas existentes para evitar conflitos
DROP POLICY IF EXISTS "Admins can view all user coupons" ON public.user_coupons;
DROP POLICY IF EXISTS "Admins can manage user coupons" ON public.user_coupons;
DROP POLICY IF EXISTS "Users can view their own redeemed coupons" ON public.user_coupons;

-- Garantir que RLS está ativo
ALTER TABLE public.user_coupons ENABLE ROW LEVEL SECURITY;

-- 1. Política para o próprio usuário (Apenas ver os seus)
CREATE POLICY "Users can view their own coupons" ON public.user_coupons
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 2. Política para Administradores (Acesso TOTAL: Ver, Editar, Apagar TODOS)
CREATE POLICY "Admins have full access to user coupons" ON public.user_coupons
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'adm'
  )
);