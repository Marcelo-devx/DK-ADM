-- 1. Atualizando create_order_from_cart
CREATE OR REPLACE FUNCTION public.create_order_from_cart(shipping_cost_input numeric, shipping_address_input jsonb, user_coupon_id_input bigint DEFAULT NULL::bigint)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  current_user_id uuid := auth.uid();
  cart_id_found bigint;
  total_cart_price numeric;
  new_order_id bigint;
  discount_amount numeric := 0;
  coupon_min_value numeric;
  final_price numeric;
BEGIN
  -- Encontra o carrinho do usuário
  SELECT id INTO cart_id_found
  FROM public.carts
  WHERE user_id = current_user_id;

  IF cart_id_found IS NULL THEN
    RAISE EXCEPTION 'Carrinho não encontrado para o usuário.';
  END IF;

  -- Calcula o preço total do carrinho
  SELECT COALESCE(SUM(ci.quantity * COALESCE(p.price, promo.price, 0)), 0)
  INTO total_cart_price
  FROM public.cart_items ci
  LEFT JOIN public.products p ON ci.item_id = p.id AND ci.item_type = 'product'
  LEFT JOIN public.promotions promo ON ci.item_id = promo.id AND ci.item_type = 'promotion'
  WHERE ci.cart_id = cart_id_found;

  -- Lida com o cupom, se fornecido
  IF user_coupon_id_input IS NOT NULL THEN
    -- Verifica o cupom e obtém o valor do desconto
    SELECT c.discount_value, c.minimum_order_value
    INTO discount_amount, coupon_min_value
    FROM public.user_coupons uc
    JOIN public.coupons c ON uc.coupon_id = c.id
    WHERE uc.id = user_coupon_id_input
      AND uc.user_id = current_user_id
      AND uc.is_used = false
      AND uc.expires_at > now();

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cupom inválido ou já utilizado.';
    END IF;

    IF total_cart_price < coupon_min_value THEN
      RAISE EXCEPTION 'O valor do pedido não atinge o mínimo para usar este cupom.';
    END IF;

    -- Marca o cupom como usado
    UPDATE public.user_coupons
    SET is_used = true
    WHERE id = user_coupon_id_input;
  END IF;

  -- Calcula o preço final
  final_price := total_cart_price - discount_amount;
  IF final_price < 0 THEN
    final_price := 0;
  END IF;

  -- Cria o novo pedido com o preço final E O VALOR DO DESCONTO
  INSERT INTO public.orders (user_id, total_price, shipping_cost, shipping_address, status, coupon_discount)
  VALUES (current_user_id, final_price, shipping_cost_input, shipping_address_input, 'Pendente', discount_amount)
  RETURNING id INTO new_order_id;

  -- Copia os itens do carrinho para os itens do pedido
  INSERT INTO public.order_items (order_id, item_id, item_type, quantity, price_at_purchase, name_at_purchase, image_url_at_purchase)
  SELECT
    new_order_id,
    ci.item_id,
    ci.item_type,
    ci.quantity,
    COALESCE(p.price, promo.price),
    COALESCE(p.name, promo.name),
    COALESCE(p.image_url, promo.image_url)
  FROM public.cart_items ci
  LEFT JOIN public.products p ON ci.item_id = p.id AND ci.item_type = 'product'
  LEFT JOIN public.promotions promo ON ci.item_id = promo.id AND ci.item_type = 'promotion'
  WHERE ci.cart_id = cart_id_found;

  -- Limpa o carrinho
  DELETE FROM public.cart_items WHERE cart_id = cart_id_found;
  DELETE FROM public.carts WHERE id = cart_id_found;

  -- Adiciona pontos ao perfil do usuário com base no valor final pago
  UPDATE public.profiles
  SET points = points + FLOOR(final_price)
  WHERE id = current_user_id;

  -- Retorna o ID do novo pedido
  RETURN new_order_id;
END;
$function$;

-- 2. Atualizando create_pending_order_from_cart
CREATE OR REPLACE FUNCTION public.create_pending_order_from_cart(shipping_cost_input numeric, shipping_address_input jsonb, user_coupon_id_input bigint DEFAULT NULL::bigint)
 RETURNS record
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  current_user_id uuid := auth.uid();
  cart_id_found bigint;
  total_cart_price numeric;
  new_order_id bigint;
  discount_amount numeric := 0;
  coupon_min_value numeric;
  final_price numeric;
  result_record record;
BEGIN
  -- Encontra o carrinho do usuário
  SELECT id INTO cart_id_found
  FROM public.carts
  WHERE user_id = current_user_id;

  IF cart_id_found IS NULL THEN
    RAISE EXCEPTION 'Carrinho não encontrado para o usuário.';
  END IF;

  -- Calcula o preço total do carrinho
  SELECT COALESCE(SUM(ci.quantity * COALESCE(p.price, promo.price, 0)), 0)
  INTO total_cart_price
  FROM public.cart_items ci
  LEFT JOIN public.products p ON ci.item_id = p.id AND ci.item_type = 'product'
  LEFT JOIN public.promotions promo ON ci.item_id = promo.id AND ci.item_type = 'promotion'
  WHERE ci.cart_id = cart_id_found;

  -- Lida com o cupom, se fornecido
  IF user_coupon_id_input IS NOT NULL THEN
    -- Verifica o cupom e obtém o valor do desconto
    SELECT c.discount_value, c.minimum_order_value
    INTO discount_amount, coupon_min_value
    FROM public.user_coupons uc
    JOIN public.coupons c ON uc.coupon_id = c.id
    WHERE uc.id = user_coupon_id_input
      AND uc.user_id = current_user_id
      AND uc.is_used = false
      AND uc.expires_at > now();

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cupom inválido ou já utilizado.';
    END IF;

    IF total_cart_price < coupon_min_value THEN
      RAISE EXCEPTION 'O valor do pedido não atinge o mínimo para usar este cupom (R$ %).', coupon_min_value;
    END IF;
  END IF;

  -- Calcula o preço final
  final_price := total_cart_price - discount_amount;
  IF final_price < 0 THEN
    final_price := 0;
  END IF;

  -- Cria o novo pedido com o preço final E O VALOR DO DESCONTO no status 'Aguardando Pagamento'
  INSERT INTO public.orders (user_id, total_price, shipping_cost, shipping_address, status, coupon_discount)
  VALUES (current_user_id, final_price, shipping_cost_input, shipping_address_input, 'Aguardando Pagamento', discount_amount)
  RETURNING id INTO new_order_id;

  -- Copia os itens do carrinho para os itens do pedido
  INSERT INTO public.order_items (order_id, item_id, item_type, quantity, price_at_purchase, name_at_purchase, image_url_at_purchase)
  SELECT
    new_order_id,
    ci.item_id,
    ci.item_type,
    ci.quantity,
    COALESCE(p.price, promo.price),
    COALESCE(p.name, promo.name),
    COALESCE(p.image_url, promo.image_url)
  FROM public.cart_items ci
  LEFT JOIN public.products p ON ci.item_id = p.id AND ci.item_type = 'product'
  LEFT JOIN public.promotions promo ON ci.item_id = promo.id AND ci.item_type = 'promotion'
  WHERE ci.cart_id = cart_id_found;

  -- Retorna o ID do novo pedido e o preço final
  SELECT new_order_id, final_price INTO result_record;
  RETURN result_record;
END;
$function$;

-- 3. Atualizando create_pending_order_from_local_cart
CREATE OR REPLACE FUNCTION public.create_pending_order_from_local_cart(shipping_cost_input numeric, shipping_address_input jsonb, cart_items_input jsonb, user_coupon_id_input bigint DEFAULT NULL::bigint)
 RETURNS record
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  current_user_id uuid := auth.uid();
  total_cart_price numeric := 0;
  new_order_id bigint;
  discount_amount numeric := 0;
  coupon_min_value numeric;
  final_price numeric;
  result_record record;
  item_json jsonb; 
  item_price numeric;
  item_name text;
  item_image_url text;
  item_stock integer;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  -- 1. Calcular o preço total e verificar estoque
  FOR item_json IN SELECT jsonb_array_elements(cart_items_input)
  LOOP
    DECLARE
      v_item_id bigint := (item_json->>'itemId')::bigint;
      v_item_type text := item_json->>'itemType';
      v_quantity integer := (item_json->>'quantity')::integer;
    BEGIN
      IF v_item_type = 'product' THEN
        SELECT price, name, image_url, stock_quantity INTO item_price, item_name, item_image_url, item_stock
        FROM public.products WHERE id = v_item_id;
        
        IF item_price IS NULL THEN
          RAISE EXCEPTION 'Produto com ID % não encontrado.', v_item_id;
        END IF;
        IF item_stock < v_quantity THEN
          RAISE EXCEPTION 'Estoque insuficiente para o produto %.', item_name;
        END IF;
        
      ELSIF v_item_type = 'promotion' THEN
        SELECT price, name, image_url, stock_quantity INTO item_price, item_name, item_image_url, item_stock
        FROM public.promotions WHERE id = v_item_id;
        
        IF item_price IS NULL THEN
          RAISE EXCEPTION 'Promoção com ID % não encontrada.', v_item_id;
        END IF;
        IF item_stock < v_quantity THEN
          RAISE EXCEPTION 'Estoque insuficiente para a promoção %.', item_name;
        END IF;
      ELSE
        RAISE EXCEPTION 'Tipo de item inválido: %', v_item_type;
      END IF;

      total_cart_price := total_cart_price + (item_price * v_quantity);
    END;
  END LOOP;

  IF total_cart_price = 0 THEN
    RAISE EXCEPTION 'Carrinho vazio.';
  END IF;

  -- 2. Lida com o cupom, se fornecido
  IF user_coupon_id_input IS NOT NULL THEN
    SELECT c.discount_value, c.minimum_order_value
    INTO discount_amount, coupon_min_value
    FROM public.user_coupons uc
    JOIN public.coupons c ON uc.coupon_id = c.id
    WHERE uc.id = user_coupon_id_input
      AND uc.user_id = current_user_id
      AND uc.is_used = false
      AND uc.expires_at > now();

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Cupom inválido ou já utilizado.';
    END IF;

    IF total_cart_price < coupon_min_value THEN
      RAISE EXCEPTION 'O valor do pedido não atinge o mínimo para usar este cupom (R$ %).', coupon_min_value;
    END IF;
  END IF;

  -- 3. Calcula o preço final
  final_price := total_cart_price - discount_amount;
  IF final_price < 0 THEN
    final_price := 0;
  END IF;

  -- 4. Cria o novo pedido no status 'Aguardando Pagamento' COM O VALOR DO DESCONTO
  INSERT INTO public.orders (user_id, total_price, shipping_cost, shipping_address, status, coupon_discount)
  VALUES (current_user_id, final_price, shipping_cost_input, shipping_address_input, 'Aguardando Pagamento', discount_amount)
  RETURNING id INTO new_order_id;

  -- 5. Copia os itens do carrinho para os itens do pedido
  FOR item_json IN SELECT jsonb_array_elements(cart_items_input)
  LOOP
    DECLARE
      v_item_id bigint := (item_json->>'itemId')::bigint;
      v_item_type text := item_json->>'itemType';
      v_quantity integer := (item_json->>'quantity')::integer;
    BEGIN
      IF v_item_type = 'product' THEN
        SELECT price, name, image_url INTO item_price, item_name, item_image_url
        FROM public.products WHERE id = v_item_id;
      ELSIF v_item_type = 'promotion' THEN
        SELECT price, name, image_url INTO item_price, item_name, item_image_url
        FROM public.promotions WHERE id = v_item_id;
      END IF;

      INSERT INTO public.order_items (order_id, item_id, item_type, quantity, price_at_purchase, name_at_purchase, image_url_at_purchase)
      VALUES (new_order_id, v_item_id, v_item_type, v_quantity, item_price, item_name, item_image_url);
    END;
  END LOOP;

  -- 6. Retorna o ID do novo pedido e o preço final
  SELECT new_order_id, final_price INTO result_record;
  RETURN result_record;
END;
$function$;