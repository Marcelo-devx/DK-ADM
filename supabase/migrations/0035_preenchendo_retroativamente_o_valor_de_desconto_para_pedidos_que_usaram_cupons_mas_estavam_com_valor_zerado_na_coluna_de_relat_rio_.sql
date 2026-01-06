-- Atualiza a coluna coupon_discount baseada na diferença entre o somatório dos itens e o preço total do pedido
UPDATE public.orders o
SET coupon_discount = sub.expected_total - o.total_price
FROM (
    SELECT order_id, SUM(quantity * price_at_purchase) as expected_total
    FROM public.order_items
    GROUP BY order_id
) sub
WHERE o.id = sub.order_id 
  AND o.coupon_discount = 0 
  AND (sub.expected_total - o.total_price) > 0;