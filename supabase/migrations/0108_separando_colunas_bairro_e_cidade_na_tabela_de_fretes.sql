-- 1. Adicionar coluna de cidade
ALTER TABLE public.shipping_rates ADD COLUMN IF NOT EXISTS city TEXT DEFAULT 'Curitiba';

-- 2. Limpar o sufixo " - Curitiba" dos nomes atuais (se houver)
UPDATE public.shipping_rates
SET location_name = REPLACE(location_name, ' - Curitiba', '')
WHERE location_name LIKE '% - Curitiba';

-- 3. Renomear location_name para neighborhood
ALTER TABLE public.shipping_rates RENAME COLUMN location_name TO neighborhood;

-- 4. Remover a restrição antiga de unicidade (pois agora a unicidade deve ser par Bairro+Cidade)
ALTER TABLE public.shipping_rates DROP CONSTRAINT IF EXISTS shipping_rates_location_name_key;

-- 5. Adicionar nova restrição de unicidade composta
ALTER TABLE public.shipping_rates ADD CONSTRAINT shipping_rates_neighborhood_city_key UNIQUE (neighborhood, city);