-- Adiciona a coluna ohms na tabela product_variants se não existir
ALTER TABLE public.product_variants 
ADD COLUMN IF NOT EXISTS ohms text;