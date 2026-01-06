-- Adiciona a coluna driver_id na tabela de rotas para vincular um motoboy
ALTER TABLE public.delivery_routes 
ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL;

-- Garante que temos pelo menos uma rota de exemplo vinculada a ordens reais se existirem
-- (Isso ajuda a popular o dashboard inicialmente)