-- 1. Cria a função que calcula e devolve o estoque
CREATE OR REPLACE FUNCTION public.return_stock_on_promotion_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  item RECORD;
  qty_to_return INTEGER;
BEGIN
  -- Só precisa devolver se o kit tiver estoque positivo reservado
  IF OLD.stock_quantity > 0 THEN
    
    -- Itera sobre todos os itens que compõem este kit
    FOR item IN SELECT * FROM public.promotion_items WHERE promotion_id = OLD.id
    LOOP
      -- Cálculo: Estoque do Kit * Quantidade de itens por kit
      qty_to_return := item.quantity * OLD.stock_quantity;

      IF qty_to_return > 0 THEN
        IF item.variant_id IS NOT NULL THEN
          -- Devolve para a Variação (Sabor/Cor)
          UPDATE public.product_variants 
          SET stock_quantity = stock_quantity + qty_to_return 
          WHERE id = item.variant_id;
        ELSE
          -- Devolve para o Produto Base (Simples)
          UPDATE public.products 
          SET stock_quantity = stock_quantity + qty_to_return 
          WHERE id = item.product_id;
        END IF;
      END IF;
    END LOOP;
    
  END IF;

  RETURN OLD;
END;
$$;

-- 2. Remove o trigger antigo se existir (para evitar duplicidade ou conflito)
DROP TRIGGER IF EXISTS trigger_return_stock_on_promotion_delete ON public.promotions;

-- 3. Cria o novo trigger que dispara ANTES da exclusão
CREATE TRIGGER trigger_return_stock_on_promotion_delete
BEFORE DELETE ON public.promotions
FOR EACH ROW
EXECUTE FUNCTION public.return_stock_on_promotion_delete();