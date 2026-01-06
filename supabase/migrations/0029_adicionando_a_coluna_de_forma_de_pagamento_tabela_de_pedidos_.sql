-- Adiciona coluna de forma de pagamento
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method TEXT;

-- Adiciona um comentário para clareza
COMMENT ON COLUMN public.orders.payment_method IS 'Forma de pagamento escolhida pelo cliente (Pix, Cartão de Crédito, etc)';