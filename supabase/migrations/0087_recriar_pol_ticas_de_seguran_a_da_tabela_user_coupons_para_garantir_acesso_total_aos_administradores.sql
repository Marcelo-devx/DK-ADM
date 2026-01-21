-- Remove política antiga se existir (para evitar duplicidade ou conflito)
DROP POLICY IF EXISTS "Admins have full access to user coupons" ON user_coupons;

-- Cria política robusta
CREATE POLICY "Admins have full access to user coupons" 
ON user_coupons 
FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() AND profiles.role = 'adm'
  )
);