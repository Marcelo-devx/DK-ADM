-- Adiciona a coluna para armazenar o valor do desconto do cupom
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS coupon_discount NUMERIC DEFAULT 0;

-- Calcula o desconto para pedidos que já foram feitos (Soma dos itens + Frete - Valor Pago)
UPDATE public.orders o
SET coupon_discount = GREATEST(0, (
  SELECT COALESCE(SUM(oi.price_at_purchase * oi.quantity), 0)
  FROM public.order_items oi
  WHERE oi.order_id = o.id
) + o.shipping_cost - o.total_price);