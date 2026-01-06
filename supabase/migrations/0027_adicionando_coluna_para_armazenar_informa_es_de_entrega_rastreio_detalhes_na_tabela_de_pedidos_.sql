-- Adiciona campo de informação de entrega
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_info TEXT;