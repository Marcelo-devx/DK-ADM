-- Adiciona a coluna ohms na tabela product_variants
ALTER TABLE public.product_variants 
ADD COLUMN IF NOT EXISTS ohms text;