-- Função para calcular e atualizar o estoque total do produto
CREATE OR REPLACE FUNCTION public.sync_product_total_stock()
RETURNS TRIGGER AS $$
BEGIN
  -- Calcula a soma de stock_quantity de todas as variações do produto afetado
  UPDATE public.products
  SET stock_quantity = (
    SELECT COALESCE(SUM(stock_quantity), 0)
    FROM public.product_variants
    WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)
  )
  WHERE id = COALESCE(NEW.product_id, OLD.product_id)
  -- Apenas atualiza se o produto tiver variações
  AND EXISTS (
    SELECT 1 FROM public.product_variants 
    WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)
  );

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger para Insert, Update e Delete na tabela de variações
DROP TRIGGER IF EXISTS trigger_sync_stock ON public.product_variants;
CREATE TRIGGER trigger_sync_stock
AFTER INSERT OR UPDATE OR DELETE ON public.product_variants
FOR EACH ROW EXECUTE FUNCTION public.sync_product_total_stock();