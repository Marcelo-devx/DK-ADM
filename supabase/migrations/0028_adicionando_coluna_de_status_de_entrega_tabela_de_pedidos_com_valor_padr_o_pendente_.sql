-- Adiciona a coluna de status da entrega
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'Pendente';

-- Cria um comentário para documentar os valores possíveis
COMMENT ON COLUMN public.orders.delivery_status IS 'Status da logística: Pendente, Despachado, Entregue';