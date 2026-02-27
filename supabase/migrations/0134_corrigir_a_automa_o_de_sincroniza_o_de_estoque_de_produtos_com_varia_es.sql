CREATE OR REPLACE FUNCTION public.sync_product_total_stock()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Atualiza o estoque do produto pai para ser a soma dos estoques de suas variações
  UPDATE public.products
  SET stock_quantity = (
    SELECT COALESCE(SUM(stock_quantity), 0)
    FROM public.product_variants
    WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)
  )
  WHERE id = COALESCE(NEW.product_id, OLD.product_id);

  RETURN NULL; -- O resultado é ignorado para um trigger AFTER
END;
$function$