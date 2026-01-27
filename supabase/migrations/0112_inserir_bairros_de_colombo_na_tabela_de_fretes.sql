INSERT INTO public.shipping_rates (neighborhood, city, price, is_active)
VALUES 
  ('Águas Fervidas', 'Colombo', 0, true),
  ('Bacaetava', 'Colombo', 0, true),
  ('Boicininga', 'Colombo', 0, true),
  ('Butiatumirim', 'Colombo', 0, true),
  ('Campestre', 'Colombo', 0, true),
  ('Capivari', 'Colombo', 0, true),
  ('Colônia Antônio Prado', 'Colombo', 0, true),
  ('Colônia Faria', 'Colombo', 0, true),
  ('Gabirobal', 'Colombo', 0, true),
  ('Imbuial', 'Colombo', 0, true),
  ('Itajacuru', 'Colombo', 0, true),
  ('Morro Grande', 'Colombo', 0, true),
  ('Poço Negro', 'Colombo', 0, true),
  ('Ribeirão das Onças', 'Colombo', 0, true),
  ('Roseira', 'Colombo', 0, true),
  ('Santa Gema', 'Colombo', 0, true),
  ('São João', 'Colombo', 0, true),
  ('Sapopema', 'Colombo', 0, true),
  ('Serrinha', 'Colombo', 0, true),
  ('Uvaranal', 'Colombo', 0, true)
ON CONFLICT (neighborhood, city) DO NOTHING;