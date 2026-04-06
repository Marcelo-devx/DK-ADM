-- Adicionar política de DELETE para permitir que administradores excluam perfis de usuários
-- Isso corrige o problema onde a função admin-delete-user não consegue excluir usuários
-- devido à falta de uma política de RLS para DELETE na tabela profiles

-- Permitir que administradores excluam qualquer perfil
CREATE POLICY "Admins can delete profiles" 
ON public.profiles 
FOR DELETE 
TO authenticated
USING (
  (SELECT p.role FROM profiles p WHERE p.id = auth.uid()) = 'adm'
);

-- Comentário sobre a política:
COMMENT ON POLICY "Admins can delete profiles" ON public.profiles IS 
'Permite que usuários com role=adm excluam registros da tabela profiles';
