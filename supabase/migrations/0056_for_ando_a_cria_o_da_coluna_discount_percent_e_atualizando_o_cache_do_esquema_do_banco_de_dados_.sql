-- Garantir que a coluna existe
ALTER TABLE public.promotions 
ADD COLUMN IF NOT EXISTS discount_percent NUMERIC DEFAULT 0;

-- Forçar atualização do cache do PostgREST (API do Supabase)
NOTIFY pgrst, 'reload config';