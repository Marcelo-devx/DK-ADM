-- Adiciona a coluna ohms na tabela product_variants se ela ainda não existir
ALTER TABLE public.product_variants 
ADD COLUMN IF NOT EXISTS ohms text;

-- Força a atualização do cache do PostgREST para ele reconhecer a nova coluna imediatamente
NOTIFY pgrst, 'reload config';