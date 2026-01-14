CREATE OR REPLACE FUNCTION public.decrement_stock(table_name text, row_id bigint, quantity int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF table_name = 'products' THEN
    UPDATE public.products SET stock_quantity = stock_quantity - quantity WHERE id = row_id;
  ELSIF table_name = 'product_variants' THEN
    -- Note: product_variants uses UUID usually, but let's handle casting if needed or create separate logic
    -- Since your product_variants uses UUID 'id', we need to be careful with types.
    -- Let's assume input row_id is actually passed as text/uuid if needed, 
    -- but here the function signature says bigint.
    -- Let's create a specialized one for variants or handle casting.
    RAISE EXCEPTION 'Use decrement_variant_stock for variants';
  END IF;
END;
$$;

-- Specialized function for UUID variants
CREATE OR REPLACE FUNCTION public.decrement_variant_stock(variant_id uuid, quantity int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.product_variants SET stock_quantity = stock_quantity - quantity WHERE id = variant_id;
END;
$$;