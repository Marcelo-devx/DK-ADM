CREATE OR REPLACE FUNCTION public.admin_delete_product(p_product_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- 1. Verificação de Segurança: Histórico de Vendas
  -- Não permitimos excluir produtos que já foram vendidos para não quebrar relatórios financeiros/pedidos antigos.
  IF EXISTS (SELECT 1 FROM order_items WHERE item_id = p_product_id AND item_type = 'product') THEN
    RAISE EXCEPTION 'Este produto possui histórico de vendas e não pode ser excluído. Recomendamos desativar a visibilidade dele.';
  END IF;

  -- 2. Limpeza de Dependências (Filhos)
  -- Removemos os registros atrelados que impediriam a exclusão
  DELETE FROM product_variants WHERE product_id = p_product_id;
  DELETE FROM product_flavors WHERE product_id = p_product_id;
  DELETE FROM reviews WHERE product_id = p_product_id;
  DELETE FROM sales_popups WHERE product_id = p_product_id;
  DELETE FROM promotion_items WHERE product_id = p_product_id;
  DELETE FROM supplier_order_items WHERE product_id = p_product_id; -- Remove de pedidos de compra (fornecedor) se houver
  
  -- 3. Exclusão do Produto Principal
  DELETE FROM products WHERE id = p_product_id;
END;
$$;