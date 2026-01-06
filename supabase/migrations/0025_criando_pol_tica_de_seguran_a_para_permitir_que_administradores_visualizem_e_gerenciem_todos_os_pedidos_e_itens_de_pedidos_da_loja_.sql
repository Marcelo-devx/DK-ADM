-- Permitir que ADMs vejam todos os pedidos
CREATE POLICY "Admins can view all orders" ON public.orders 
FOR SELECT TO authenticated 
USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'adm');

-- Permitir que ADMs atualizem status de pedidos
CREATE POLICY "Admins can update all orders" ON public.orders 
FOR UPDATE TO authenticated 
USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'adm');

-- Permitir que ADMs excluam pedidos
CREATE POLICY "Admins can delete all orders" ON public.orders 
FOR DELETE TO authenticated 
USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'adm');