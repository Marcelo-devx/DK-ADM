-- 1. Corrigir a função de finalizar pagamento para NÃO subtrair estoque de novo (pois já foi subtraído no carrinho)
CREATE OR REPLACE FUNCTION public.finalize_order_payment(p_order_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_order_user_id uuid;
  v_order_status text;
  v_total_price numeric;
  v_cart_id bigint;
BEGIN
  -- Verifica o status atual do pedido
  SELECT user_id, status, total_price 
  INTO v_order_user_id, v_order_status, v_total_price
  FROM public.orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;
  
  IF v_order_status = 'Finalizada' THEN
    RETURN;
  END IF;

  -- 1. Atualiza o status para 'Finalizada'
  UPDATE public.orders SET status = 'Finalizada' WHERE id = p_order_id;

  -- 2. Ativa o cartão de crédito para compras futuras
  UPDATE public.profiles SET is_credit_card_enabled = TRUE WHERE id = v_order_user_id;

  -- 3. Adiciona pontos ao perfil
  UPDATE public.profiles SET points = points + FLOOR(v_total_price) WHERE id = v_order_user_id;
END;
$function$;

-- 2. Criar função para devolver estoque
CREATE OR REPLACE FUNCTION public.return_order_stock()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o pedido for deletado OU mudar de qualquer status para 'Cancelado'
  IF (TG_OP = 'DELETE') OR (TG_OP = 'UPDATE' AND NEW.status = 'Cancelado' AND OLD.status <> 'Cancelado') THEN
    -- Itera sobre os itens do pedido e devolve ao estoque
    UPDATE public.products p
    SET stock_quantity = p.stock_quantity + oi.quantity
    FROM public.order_items oi
    WHERE oi.order_id = COALESCE(OLD.id, NEW.id) 
    AND oi.item_id = p.id 
    AND oi.item_type = 'product';
    
    -- Também devolve para promoções/kits se houver
    UPDATE public.promotions promo
    SET stock_quantity = promo.stock_quantity + oi.quantity
    FROM public.order_items oi
    WHERE oi.order_id = COALESCE(OLD.id, NEW.id) 
    AND oi.item_id = promo.id 
    AND oi.item_type = 'promotion';
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 3. Aplicar os gatilhos de devolução de estoque
DROP TRIGGER IF EXISTS trigger_return_stock_on_delete ON public.orders;
CREATE TRIGGER trigger_return_stock_on_delete
BEFORE DELETE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.return_order_stock();

DROP TRIGGER IF EXISTS trigger_return_stock_on_cancel ON public.orders;
CREATE TRIGGER trigger_return_stock_on_cancel
AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.return_order_stock();