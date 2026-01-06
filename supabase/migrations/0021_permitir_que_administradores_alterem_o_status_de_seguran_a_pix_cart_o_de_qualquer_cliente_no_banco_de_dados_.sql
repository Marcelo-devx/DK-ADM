-- Adiciona política para permitir que administradores atualizem qualquer perfil
CREATE POLICY "Admins can update any profile" ON public.profiles
FOR UPDATE TO authenticated
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'adm'
)
WITH CHECK (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'adm'
);