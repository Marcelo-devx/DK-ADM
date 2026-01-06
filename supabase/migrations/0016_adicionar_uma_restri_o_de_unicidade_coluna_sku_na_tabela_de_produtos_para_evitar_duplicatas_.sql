-- Adiciona uma restrição para garantir que cada SKU seja único na tabela de produtos.
ALTER TABLE public.products
ADD CONSTRAINT products_sku_unique UNIQUE (sku);