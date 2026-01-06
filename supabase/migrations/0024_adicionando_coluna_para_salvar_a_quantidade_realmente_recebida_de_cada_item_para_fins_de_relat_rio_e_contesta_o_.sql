ALTER TABLE public.supplier_order_items 
ADD COLUMN IF NOT EXISTS received_quantity INTEGER DEFAULT 0;

-- Garantir que pedidos já recebidos tenham essa informação preenchida
UPDATE public.supplier_order_items 
SET received_quantity = quantity 
WHERE supplier_order_id IN (SELECT id FROM public.supplier_orders WHERE status = 'Recebido');