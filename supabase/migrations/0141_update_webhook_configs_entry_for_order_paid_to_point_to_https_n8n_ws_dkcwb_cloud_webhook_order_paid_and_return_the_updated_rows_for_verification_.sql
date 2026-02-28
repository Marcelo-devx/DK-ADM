-- Update order_paid webhook target URL to the new n8n host
UPDATE public.webhook_configs
SET target_url = 'https://n8n-ws.dkcwb.cloud/webhook/order_paid'
WHERE trigger_event = 'order_paid';

-- Return updated rows for verification
SELECT id, trigger_event, target_url, is_active FROM public.webhook_configs WHERE trigger_event = 'order_paid';