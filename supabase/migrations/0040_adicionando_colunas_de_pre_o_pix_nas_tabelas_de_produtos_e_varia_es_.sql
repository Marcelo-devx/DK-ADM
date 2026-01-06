-- Adiciona a coluna na tabela de produtos
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS pix_price NUMERIC(10,2);

-- Adiciona a coluna na tabela de variações
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS pix_price NUMERIC(10,2);

-- Comentário para documentação
COMMENT ON COLUMN public.products.pix_price IS 'Preço promocional para pagamentos via Pix.';
COMMENT ON COLUMN public.product_variants.pix_price IS 'Preço promocional da variação para pagamentos via Pix.';