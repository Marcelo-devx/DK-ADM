-- Habilita a extensão pg_net para fazer requisições HTTP de dentro do banco (caso não esteja ativa)
create extension if not exists pg_net;

-- Função que envia os dados para o Edge Function
create or replace function public.dispatch_order_webhook()
returns trigger
language plpgsql
security definer
as $$
declare
  -- URL da sua Edge Function (Baseada no seu projeto)
  endpoint_url text := 'https://jrlozhhvwqfmjtkmvukf.supabase.co/functions/v1/dispatch-webhook';
  -- Chave Anon (Pública) - Suficiente para disparar a função
  api_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpybG96aGh2d3FmbWp0a212dWtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNDU2NjQsImV4cCI6MjA2NzkyMTY2NH0.Do5c1-TKqpyZTJeX_hLbw1SU40CbwXfCIC-pPpcD_JM';
  event_type text;
begin
  -- Determina o tipo de evento
  if (TG_OP = 'INSERT') then
    event_type := 'order_created';
  elsif (TG_OP = 'UPDATE') then
    event_type := 'order_updated';
    -- Otimização: Só dispara se o status ou status de entrega mudou
    if (OLD.status IS NOT DISTINCT FROM NEW.status AND OLD.delivery_status IS NOT DISTINCT FROM NEW.delivery_status) then
      return new;
    end if;
  end if;

  -- Faz a chamada POST assíncrona para a função dispatch-webhook
  -- Isso não trava a criação do pedido pelo usuário
  perform net.http_post(
    url := endpoint_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || api_key
    ),
    body := jsonb_build_object(
      'event_type', event_type,
      'payload', row_to_json(new)
    )
  );

  return new;
exception when others then
  -- Evita que erros no webhook travem a venda
  return new;
end;
$$;

-- Remove gatilhos antigos para evitar duplicação ou conflito
drop trigger if exists trigger_dispatch_order_created on public.orders;
drop trigger if exists trigger_dispatch_order_updated on public.orders;

-- Cria o gatilho para PEDIDOS NOVOS
create trigger trigger_dispatch_order_created
  after insert on public.orders
  for each row
  execute function public.dispatch_order_webhook();

-- Cria o gatilho para PEDIDOS ATUALIZADOS (Status mudou)
create trigger trigger_dispatch_order_updated
  after update on public.orders
  for each row
  execute function public.dispatch_order_webhook();