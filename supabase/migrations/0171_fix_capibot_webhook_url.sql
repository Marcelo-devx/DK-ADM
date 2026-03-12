-- Corrigir a URL do webhook order_paid para apontar para o capibot
UPDATE public.webhook_configs
SET 
  target_url = 'https://capibot-n8nwebhook.zusrjw.easypanel.host/webhook/Pedido-criado',
  description = 'Integração Capibot N8N - Notificação de Pagamento Confirmado',
  is_active = true
WHERE trigger_event = 'order_paid';

-- Verificar a atualização
SELECT id, trigger_event, target_url, description, is_active 
FROM public.webhook_configs 
WHERE trigger_event = 'order_paid';
