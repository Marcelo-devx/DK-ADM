INSERT INTO public.shipping_rates (neighborhood, city, price, is_active)
VALUES 
  ('Alphaville Graciosa', 'Pinhais', 0, true),
  ('Alto Tarumã', 'Pinhais', 0, true),
  ('Atuba', 'Pinhais', 0, true),
  ('Centro', 'Pinhais', 0, true),
  ('Emiliano Perneta', 'Pinhais', 0, true),
  ('Estância Pinhais', 'Pinhais', 0, true),
  ('Jardim Amélia', 'Pinhais', 0, true),
  ('Jardim Cláudia', 'Pinhais', 0, true),
  ('Jardim Karla', 'Pinhais', 0, true),
  ('Maria Antonieta', 'Pinhais', 0, true),
  ('Parque das Águas', 'Pinhais', 0, true),
  ('Parque das Nascentes', 'Pinhais', 0, true),
  ('Pineville', 'Pinhais', 0, true),
  ('Vargem Grande', 'Pinhais', 0, true),
  ('Weissópolis', 'Pinhais', 0, true)
ON CONFLICT (neighborhood, city) DO NOTHING;