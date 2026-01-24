-- Remove qualquer configuração anterior para evitar duplicidade neste evento
DELETE FROM public.webhook_configs WHERE target_url = 'https://capibot-n8nwebhook.zusrjw.easypanel.host/webhook/Pedido-criado';

-- Insere o Webhook para Pedidos Criados
INSERT INTO public.webhook_configs (trigger_event, target_url, description, is_active)
VALUES (
  'order_created',
  'https://capibot-n8nwebhook.zusrjw.easypanel.host/webhook/Pedido-criado',
  'Integração N8N - Pedido Criado',
  true
);

-- Opcional: Se quiser usar a mesma URL para Pagamento Confirmado (muito comum para liberar acesso/entregas)
INSERT INTO public.webhook_configs (trigger_event, target_url, description, is_active)
VALUES (
  'payment_confirmed',
  'https://capibot-n8nwebhook.zusrjw.easypanel.host/webhook/Pedido-criado',
  'Integração N8N - Pagamento Confirmado',
  true
);