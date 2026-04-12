-- Corrige pedidos pagos/finalizados para ficar com entrega Aguardando Coleta quando ainda estiver Pendente
CREATE OR REPLACE FUNCTION public.update_delivery_status_on_order_finish()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    IF NEW.status IN ('Pago', 'Finalizada') AND OLD.delivery_status = 'Pendente' THEN
        NEW.delivery_status = 'Aguardando Coleta';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_delivery_status_on_finish ON public.orders;

CREATE TRIGGER trigger_update_delivery_status_on_finish
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_delivery_status_on_order_finish();

UPDATE public.orders
SET delivery_status = 'Aguardando Coleta'
WHERE status IN ('Pago', 'Finalizada')
  AND delivery_status = 'Pendente';
