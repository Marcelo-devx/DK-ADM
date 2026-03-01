UPDATE public.webhook_configs
SET 
  target_url = 'https://seu-n8n.com/webhook/pedido-pago',
  description = 'Disparado quando um pedido é confirmado como pago (Cartão, Pix, etc).',
  is_active = true
WHERE trigger_event = 'order_paid';