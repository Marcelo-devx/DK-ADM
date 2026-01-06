-- Tabela de Variações
CREATE TABLE public.product_variants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id BIGINT REFERENCES public.products(id) ON DELETE CASCADE,
  flavor_id BIGINT REFERENCES public.flavors(id) ON DELETE SET NULL,
  volume_ml INTEGER, -- Tamanho em ml
  sku TEXT UNIQUE,
  price NUMERIC(10,2) NOT NULL,
  cost_price NUMERIC(10,2),
  stock_quantity INTEGER DEFAULT 0 NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
CREATE POLICY "Public read access for variants" ON public.product_variants 
FOR SELECT USING (is_active = true);

CREATE POLICY "Admin full access for variants" ON public.product_variants 
FOR ALL TO authenticated USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'adm'
);