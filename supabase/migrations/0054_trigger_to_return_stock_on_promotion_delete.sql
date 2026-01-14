-- 1. Função Trigger para devolver estoque ao deletar promoção
CREATE OR REPLACE FUNCTION public.return_promotion_stock_on_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  item RECORD;
  v_qty_to_return INTEGER;
BEGIN
  -- Se o estoque do kit for 0 ou menor, não há nada reservado para devolver
  IF OLD.stock_quantity <= 0 THEN
    RETURN OLD;
  END IF;

  -- Itera sobre os itens do kit que está sendo excluído
  FOR item IN SELECT * FROM public.promotion_items WHERE promotion_id = OLD.id
  LOOP
    v_qty_to_return := item.quantity * OLD.stock_quantity;

    IF v_qty_to_return > 0 THEN
        IF item.variant_id IS NOT NULL THEN
          UPDATE public.product_variants 
          SET stock_quantity = stock_quantity + v_qty_to_return 
          WHERE id = item.variant_id;
        ELSE
          UPDATE public.products 
          SET stock_quantity = stock_quantity + v_qty_to_return 
          WHERE id = item.product_id;
        END IF;
    END IF;
  END LOOP;

  RETURN OLD;
END;
$$;

-- 2. Criar o Trigger na tabela promotions
DROP TRIGGER IF EXISTS on_promotion_delete ON public.promotions;
CREATE TRIGGER on_promotion_delete
  BEFORE DELETE ON public.promotions
  FOR EACH ROW EXECUTE FUNCTION public.return_promotion_stock_on_delete();

-- 3. Reforçar a função de adicionar item para garantir o bloqueio correto
CREATE OR REPLACE FUNCTION public.add_item_to_kit_and_lock_stock(p_promotion_id bigint, p_product_id bigint, p_variant_id uuid, p_quantity_per_kit integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_kit_stock INTEGER;
  v_total_needed INTEGER;
  v_current_stock INTEGER;
BEGIN
  -- Descobrir estoque atual do kit
  SELECT COALESCE(stock_quantity, 0) INTO v_kit_stock FROM public.promotions WHERE id = p_promotion_id;
  
  IF v_kit_stock IS NULL THEN
    RAISE EXCEPTION 'Kit não encontrado.';
  END IF;

  -- Calcular total necessário para todos os kits existentes
  v_total_needed := v_kit_stock * p_quantity_per_kit;

  -- Se o kit já tem estoque (ex: 10 kits), precisamos deduzir 10 * qtd do novo item do estoque principal
  IF v_total_needed > 0 THEN
    IF p_variant_id IS NOT NULL THEN
      -- É uma variação
      SELECT stock_quantity INTO v_current_stock FROM public.product_variants WHERE id = p_variant_id FOR UPDATE;
      
      IF v_current_stock < v_total_needed THEN
        RAISE EXCEPTION 'Estoque insuficiente da variação para adicionar a este kit (Já existem % kits montados). Necessário: %, Disponível: %', v_kit_stock, v_total_needed, v_current_stock;
      END IF;

      UPDATE public.product_variants SET stock_quantity = stock_quantity - v_total_needed WHERE id = p_variant_id;
    ELSE
      -- É um produto simples
      SELECT stock_quantity INTO v_current_stock FROM public.products WHERE id = p_product_id FOR UPDATE;
      
      IF v_current_stock < v_total_needed THEN
        RAISE EXCEPTION 'Estoque insuficiente do produto para adicionar a este kit (Já existem % kits montados). Necessário: %, Disponível: %', v_kit_stock, v_total_needed, v_current_stock;
      END IF;

      UPDATE public.products SET stock_quantity = stock_quantity - v_total_needed WHERE id = p_product_id;
    END IF;
  END IF;

  -- Inserir o vínculo na tabela
  INSERT INTO public.promotion_items (promotion_id, product_id, variant_id, quantity)
  VALUES (p_promotion_id, p_product_id, p_variant_id, p_quantity_per_kit);
END;
$function$;