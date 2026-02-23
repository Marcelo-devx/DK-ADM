-- Habilita a extensão de rede (caso não esteja)
create extension if not exists pg_net;

-- 1. Função Específica para Order Created (Sem lógica complexa)
create or replace function public.dispatch_order_created_direct()
returns trigger
language plpgsql
security definer
as $$
declare
  -- URL Direta da sua Edge Function
  endpoint_url text := 'https://jrlozhhvwqfmjtkmvukf.supabase.co/functions/v1/dispatch-webhook';
  -- Chave de API (Anon Key)
  api_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpybG96aGh2d3FmbWp0a212dWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNDU2NjQsImV4cCI6MjA2NzkyMTY2NH0.Do5c1-TKqpyZTJeX_hLbw1SU40CbwXfCIC-pPpcD_JM';
begin
  -- Envio INCONDICIONAL: Entrou um pedido, manda pro webhook.
  perform net.http_post(
    url := endpoint_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || api_key
    ),
    body := jsonb_build_object(
      'event_type', 'order_created',
      'payload', row_to_json(new)
    )
  );

  return new;
exception when others then
  -- Garante que o pedido é salvo mesmo se a rede falhar
  return new;
end;
$$;

-- 2. Limpeza de gatilhos anteriores que poderiam estar conflitantes
drop trigger if exists trigger_dispatch_order_created on public.orders;
drop trigger if exists trigger_order_created_robust on public.orders;

-- 3. Criação do Gatilho Limpo (Apenas INSERT)
create trigger trigger_dispatch_order_created_v2
  after insert on public.orders
  for each row
  execute function public.dispatch_order_created_direct();