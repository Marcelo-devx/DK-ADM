-- Adiciona a coluna discount_percent na tabela de promoções
ALTER TABLE public.promotions 
ADD COLUMN IF NOT EXISTS discount_percent NUMERIC DEFAULT 0;