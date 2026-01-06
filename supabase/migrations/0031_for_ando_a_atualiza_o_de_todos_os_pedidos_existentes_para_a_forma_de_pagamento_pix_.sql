-- Garante que a coluna existe e atualiza todos os registros
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method TEXT;
UPDATE public.orders SET payment_method = 'Pix';