-- Função 1: Adicionar item ao kit e travar estoque
CREATE OR REPLACE FUNCTION public.add_item_to_kit_and_lock_stock(
  p_promotion_id BIGINT,
  p_product_id BIGINT,
  p_variant_id UUID,
  p_quantity_per_kit INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_kit_stock INTEGER;
  v_total_needed INTEGER;
  v_current_stock INTEGER;
BEGIN
  -- 1. Descobrir quantos kits existem
  SELECT stock_quantity INTO v_kit_stock FROM public.promotions WHERE id = p_promotion_id;
  
  IF v_kit_stock IS NULL THEN
    RAISE EXCEPTION 'Kit não encontrado.';
  END IF;

  -- 2. Calcular total de produtos necessários (Estoque do Kit * Qtd por Kit)
  v_total_needed := v_kit_stock * p_quantity_per_kit;

  -- 3. Verificar e Deduzir estoque do produto/variação
  IF v_total_needed > 0 THEN
    IF p_variant_id IS NOT NULL THEN
      -- É uma variação
      SELECT stock_quantity INTO v_current_stock FROM public.product_variants WHERE id = p_variant_id FOR UPDATE;
      
      IF v_current_stock < v_total_needed THEN
        RAISE EXCEPTION 'Estoque insuficiente da variação para montar % kits. Necessário: %, Disponível: %', v_kit_stock, v_total_needed, v_current_stock;
      END IF;

      UPDATE public.product_variants SET stock_quantity = stock_quantity - v_total_needed WHERE id = p_variant_id;
    ELSE
      -- É um produto simples
      SELECT stock_quantity INTO v_current_stock FROM public.products WHERE id = p_product_id FOR UPDATE;
      
      IF v_current_stock < v_total_needed THEN
        RAISE EXCEPTION 'Estoque insuficiente do produto para montar % kits. Necessário: %, Disponível: %', v_kit_stock, v_total_needed, v_current_stock;
      END IF;

      UPDATE public.products SET stock_quantity = stock_quantity - v_total_needed WHERE id = p_product_id;
    END IF;
  END IF;

  -- 4. Inserir o vínculo na tabela
  INSERT INTO public.promotion_items (promotion_id, product_id, variant_id, quantity)
  VALUES (p_promotion_id, p_product_id, p_variant_id, p_quantity_per_kit);
END;
$$;

-- Função 2: Remover item do kit e devolver estoque
CREATE OR REPLACE FUNCTION public.remove_item_from_kit_and_unlock_stock(
  p_item_id BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_promotion_id BIGINT;
  v_product_id BIGINT;
  v_variant_id UUID;
  v_qty_per_kit INTEGER;
  v_kit_stock INTEGER;
  v_total_return INTEGER;
BEGIN
  -- 1. Buscar dados do item
  SELECT promotion_id, product_id, variant_id, quantity 
  INTO v_promotion_id, v_product_id, v_variant_id, v_qty_per_kit
  FROM public.promotion_items 
  WHERE id = p_item_id;

  IF v_promotion_id IS NULL THEN
    RAISE EXCEPTION 'Item do kit não encontrado.';
  END IF;

  -- 2. Descobrir estoque atual do kit
  SELECT stock_quantity INTO v_kit_stock FROM public.promotions WHERE id = v_promotion_id;

  -- 3. Calcular devolução
  v_total_return := v_kit_stock * v_qty_per_kit;

  -- 4. Devolver estoque
  IF v_total_return > 0 THEN
    IF v_variant_id IS NOT NULL THEN
      UPDATE public.product_variants SET stock_quantity = stock_quantity + v_total_return WHERE id = v_variant_id;
    ELSE
      UPDATE public.products SET stock_quantity = stock_quantity + v_total_return WHERE id = v_product_id;
    END IF;
  END IF;

  -- 5. Remover vínculo
  DELETE FROM public.promotion_items WHERE id = p_item_id;
END;
$$;

-- Função 3: Atualizar estoque do Kit (e ajustar ingredientes proporcionalmente)
CREATE OR REPLACE FUNCTION public.update_kit_stock_level(
  p_promotion_id BIGINT,
  p_new_stock INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_stock INTEGER;
  v_diff INTEGER;
  item RECORD;
  v_needed INTEGER;
  v_current_stock INTEGER;
BEGIN
  -- 1. Pegar estoque atual
  SELECT stock_quantity INTO v_old_stock FROM public.promotions WHERE id = p_promotion_id FOR UPDATE;
  
  v_diff := p_new_stock - v_old_stock;

  -- Se não mudou nada, sai
  IF v_diff = 0 THEN RETURN; END IF;

  -- 2. Se estamos AUMENTANDO o estoque do kit, precisamos TIZAR mais produtos
  IF v_diff > 0 THEN
    FOR item IN SELECT * FROM public.promotion_items WHERE promotion_id = p_promotion_id
    LOOP
      v_needed := item.quantity * v_diff; -- Qtd por kit * Quantos kits novos

      IF item.variant_id IS NOT NULL THEN
        SELECT stock_quantity INTO v_current_stock FROM public.product_variants WHERE id = item.variant_id;
        IF v_current_stock < v_needed THEN
           RAISE EXCEPTION 'Não há estoque suficiente do componente (Variação) para aumentar o kit.';
        END IF;
        UPDATE public.product_variants SET stock_quantity = stock_quantity - v_needed WHERE id = item.variant_id;
      ELSE
        SELECT stock_quantity INTO v_current_stock FROM public.products WHERE id = item.product_id;
        IF v_current_stock < v_needed THEN
           RAISE EXCEPTION 'Não há estoque suficiente do produto % para aumentar o kit.', item.product_id;
        END IF;
        UPDATE public.products SET stock_quantity = stock_quantity - v_needed WHERE id = item.product_id;
      END IF;
    END LOOP;
  END IF;

  -- 3. Se estamos DIMINUINDO o estoque do kit, DEVOLVEMOS produtos
  IF v_diff < 0 THEN
    FOR item IN SELECT * FROM public.promotion_items WHERE promotion_id = p_promotion_id
    LOOP
      v_needed := item.quantity * ABS(v_diff); -- Qtd devolvida

      IF item.variant_id IS NOT NULL THEN
        UPDATE public.product_variants SET stock_quantity = stock_quantity + v_needed WHERE id = item.variant_id;
      ELSE
        UPDATE public.products SET stock_quantity = stock_quantity + v_needed WHERE id = item.product_id;
      END IF;
    END LOOP;
  END IF;

  -- 4. Atualizar o estoque da promoção
  UPDATE public.promotions SET stock_quantity = p_new_stock WHERE id = p_promotion_id;
END;
$$;