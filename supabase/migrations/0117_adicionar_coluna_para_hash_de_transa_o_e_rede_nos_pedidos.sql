ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS crypto_hash text UNIQUE,
ADD COLUMN IF NOT EXISTS crypto_network text DEFAULT 'BSC';

-- Índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_orders_crypto_hash ON public.orders(crypto_hash);