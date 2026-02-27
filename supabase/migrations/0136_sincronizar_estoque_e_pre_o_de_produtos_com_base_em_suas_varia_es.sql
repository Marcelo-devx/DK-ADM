WITH variant_stats AS (
  SELECT
    product_id,
    SUM(stock_quantity) as total_stock,
    MIN(price) as min_price,
    MIN(pix_price) as min_pix_price
  FROM public.product_variants
  WHERE is_active = true AND stock_quantity > 0
  GROUP BY product_id
)
UPDATE public.products p
SET
  stock_quantity = vs.total_stock,
  price = CASE
    WHEN p.price IS NULL OR p.price = 0 THEN vs.min_price
    ELSE p.price
  END,
  pix_price = CASE
    WHEN p.pix_price IS NULL OR p.pix_price = 0 THEN vs.min_pix_price
    ELSE p.pix_price
  END
FROM variant_stats vs
WHERE p.id = vs.product_id;