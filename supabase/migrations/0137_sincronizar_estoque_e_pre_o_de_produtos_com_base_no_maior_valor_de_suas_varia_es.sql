WITH variant_stats AS (
  SELECT
    product_id,
    SUM(stock_quantity) as total_stock,
    MAX(price) as max_price,
    MAX(pix_price) as max_pix_price
  FROM public.product_variants
  WHERE is_active = true
  GROUP BY product_id
)
UPDATE public.products p
SET
  stock_quantity = vs.total_stock,
  price = vs.max_price,
  pix_price = vs.max_pix_price
FROM variant_stats vs
WHERE p.id = vs.product_id;