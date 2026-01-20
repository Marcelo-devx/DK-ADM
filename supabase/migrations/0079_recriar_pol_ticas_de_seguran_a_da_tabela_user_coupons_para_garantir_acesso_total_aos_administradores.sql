-- Habilitar RLS
ALTER TABLE user_coupons ENABLE ROW LEVEL SECURITY;

-- Limpar políticas antigas para evitar conflitos
DROP POLICY IF EXISTS "Users can view their own redeemed coupons" ON user_coupons;
DROP POLICY IF EXISTS "Admins can view all user coupons" ON user_coupons;
DROP POLICY IF EXISTS "Admins can insert user coupons" ON user_coupons;
DROP POLICY IF EXISTS "Admins can update user coupons" ON user_coupons;
DROP POLICY IF EXISTS "Admins can delete user coupons" ON user_coupons;

-- 1. Usuários comuns veem apenas os seus
CREATE POLICY "Users can view their own redeemed coupons" ON user_coupons
FOR SELECT TO authenticated USING (
  auth.uid() = user_id
);

-- 2. Administradores veem TUDO (Correção principal)
CREATE POLICY "Admins can view all user coupons" ON user_coupons
FOR SELECT TO authenticated USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'adm'
);

-- 3. Administradores podem gerenciar (Inserir, Editar, Deletar)
CREATE POLICY "Admins can manage user coupons" ON user_coupons
FOR ALL TO authenticated USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'adm'
);