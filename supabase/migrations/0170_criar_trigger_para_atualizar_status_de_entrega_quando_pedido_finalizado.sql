-- Criar função para atualizar delivery_status quando pedido for finalizado
CREATE OR REPLACE FUNCTION public.update_delivery_status_on_order_finish()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    -- Quando o status muda para "Finalizada", atualiza delivery_status para "Aguardando Coleta"
    -- MAS mantém se já estiver em outro status diferente de "Pendente"
    IF NEW.status = 'Finalizada' AND OLD.status <> 'Finalizada' THEN
        IF OLD.delivery_status = 'Pendente' OR OLD.delivery_status IS NULL THEN
            NEW.delivery_status = 'Aguardando Coleta';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Remover trigger antigo se existir
DROP TRIGGER IF EXISTS trigger_update_delivery_status_on_finish ON public.orders;

-- Criar o trigger (BEFORE UPDATE para poder modificar os valores)
CREATE TRIGGER trigger_update_delivery_status_on_finish
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_delivery_status_on_order_finish();