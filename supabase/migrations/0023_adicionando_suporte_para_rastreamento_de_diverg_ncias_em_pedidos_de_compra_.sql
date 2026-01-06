ALTER TABLE public.supplier_orders 
ADD COLUMN IF NOT EXISTS received_total_cost NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS discrepancy_notes TEXT;

-- Atualizar tipos permitidos de status se necessário (o banco aceita TEXT, então estamos livres para novos status)