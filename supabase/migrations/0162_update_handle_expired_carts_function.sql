-- Atualizar função de limpeza de carrinhos expirados para usar Brasília
CREATE OR REPLACE FUNCTION public.handle_expired_carts()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  expired_cart_record RECORD;
  item_record RECORD;
BEGIN
  -- Itera sobre os carrinhos criados há mais de 15 minutos (considerando Brasília)
  FOR expired_cart_record IN
    SELECT id FROM public.carts WHERE created_at < (public.brasilia_now() - interval '15 minutes')
  LOOP
    -- Devolve o estoque dos itens do carrinho
    FOR item_record IN
      SELECT product_id, variant_id, quantity FROM public.cart_items WHERE cart_id = expired_cart_record.id
    LOOP
      UPDATE public.products
      SET stock = stock + item_record.quantity
      WHERE id = item_record.product_id;

      -- Se tiver variant_id, atualiza também o estoque da variação
      IF item_record.variant_id IS NOT NULL THEN
        UPDATE public.product_variants
        SET stock = stock + item_record.quantity
        WHERE id = item_record.variant_id;
      END IF;
    END LOOP;

    -- Remove os itens do carrinho expirado
    DELETE FROM public.cart_items WHERE cart_id = expired_cart_record.id;

    -- Remove o carrinho expirado
    DELETE FROM public.carts WHERE id = expired_cart_record.id;
  END LOOP;
END;
$$;