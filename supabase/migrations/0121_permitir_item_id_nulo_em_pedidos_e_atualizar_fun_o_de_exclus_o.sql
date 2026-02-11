-- 1. Permitir que o ID do item seja nulo na tabela de pedidos (para mantermos o registro histórico sem o produto pai)
ALTER TABLE public.order_items ALTER COLUMN item_id DROP NOT NULL;

-- 2. Atualizar a função de exclusão para DESVINCULAR em vez de BLOQUEAR
CREATE OR REPLACE FUNCTION public.admin_delete_product(p_product_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- 1. Desvincular de Pedidos (Histórico)
  -- Mantemos o registro da venda (preço, nome, foto gravados na hora da compra), 
  -- mas removemos o link com o ID do produto que vai deixar de existir.
  UPDATE order_items
  SET item_id = NULL,
      item_type = 'deleted_product'
  WHERE item_id = p_product_id;

  -- 2. Limpeza de Dependências (Filhos)
  DELETE FROM product_variants WHERE product_id = p_product_id;
  DELETE FROM product_flavors WHERE product_id = p_product_id;
  DELETE FROM reviews WHERE product_id = p_product_id;
  DELETE FROM sales_popups WHERE product_id = p_product_id;
  DELETE FROM promotion_items WHERE product_id = p_product_id;
  DELETE FROM supplier_order_items WHERE product_id = p_product_id;
  
  -- 3. Exclusão do Produto Principal
  DELETE FROM products WHERE id = p_product_id;
END;
$$;