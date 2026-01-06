-- Adiciona a coluna variant_id
ALTER TABLE public.supplier_order_items 
ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL;

-- Comentário para documentação
COMMENT ON COLUMN public.supplier_order_items.variant_id IS 'ID da variação do produto (sabor/tamanho) associada a este item do pedido.';