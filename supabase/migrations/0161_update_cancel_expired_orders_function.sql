-- Atualizar função de cancelamento de pedidos expirados para usar Brasília
CREATE OR REPLACE FUNCTION public.cancel_expired_orders()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Cancela pedidos aguardando pagamento há mais de 60 minutos (considerando Brasília)
  UPDATE public.orders
  SET status = 'Cancelado'
  WHERE status = 'Aguardando Pagamento'
    AND created_at < (public.brasilia_now() - interval '60 minutes');
END;
$$;