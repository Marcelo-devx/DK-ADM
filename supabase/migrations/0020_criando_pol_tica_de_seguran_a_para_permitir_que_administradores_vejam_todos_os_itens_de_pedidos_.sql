CREATE POLICY "Admins can view all order items"
ON public.order_items
FOR SELECT
TO authenticated
USING ( (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'adm' );