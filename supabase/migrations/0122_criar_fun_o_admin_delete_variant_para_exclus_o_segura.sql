CREATE OR REPLACE FUNCTION public.admin_delete_variant(p_variant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- 1. Desvincular de Pedidos de Fornecedor (Histórico de Compra)
  -- Mantém o registro de que algo foi comprado, mas remove o link rígido
  UPDATE supplier_order_items
  SET variant_id = NULL
  WHERE variant_id = p_variant_id;

  -- 2. Remover de Kits/Promoções
  -- Se a variação deixa de existir, ela é removida da composição dos kits
  DELETE FROM promotion_items WHERE variant_id = p_variant_id;

  -- 3. Excluir a Variação
  DELETE FROM product_variants WHERE id = p_variant_id;
END;
$$;