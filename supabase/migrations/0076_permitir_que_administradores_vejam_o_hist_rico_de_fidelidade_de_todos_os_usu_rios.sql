-- Permitir que ADMs vejam todas as linhas do histórico
CREATE POLICY "Admins can view all loyalty history" ON public.loyalty_history 
FOR SELECT TO authenticated USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'adm'
);