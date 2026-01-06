-- Tabela de Motoristas (Motoboys)
CREATE TABLE public.drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS para Motoristas
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage drivers" ON public.drivers FOR ALL TO authenticated USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'adm');
CREATE POLICY "Public read active drivers" ON public.drivers FOR SELECT TO authenticated USING (is_active = true);

-- Tabela de Rotas Diárias
CREATE TABLE public.delivery_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_date DATE NOT NULL DEFAULT CURRENT_DATE,
  name TEXT,
  status TEXT DEFAULT 'pending', -- pending, active, completed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS para Rotas
ALTER TABLE public.delivery_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage delivery routes" ON public.delivery_routes FOR ALL TO authenticated USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'adm');

-- Paradas dentro de uma Rota
CREATE TABLE public.route_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID REFERENCES public.delivery_routes(id) ON DELETE CASCADE,
  order_id BIGINT REFERENCES public.orders(id) ON DELETE SET NULL,
  address_text TEXT NOT NULL,
  customer_name TEXT,
  status TEXT DEFAULT 'pending', -- pending, delivered, failed
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS para Paradas
ALTER TABLE public.route_stops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage route stops" ON public.route_stops FOR ALL TO authenticated USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'adm');