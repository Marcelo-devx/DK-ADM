DO $$
DECLARE
  u1 UUID;
  u2 UUID;
BEGIN
  -- Busca IDs ignorando maiúsculas/minúsculas no email
  SELECT id INTO u1 FROM auth.users WHERE LOWER(email) = LOWER('Yagompiazzacwb@hotmail.com');
  SELECT id INTO u2 FROM auth.users WHERE LOWER(email) = LOWER('Yagomeirapiazza@gmail.com');

  -- Adiciona 730 pontos para o primeiro usuário
  IF u1 IS NOT NULL THEN
    PERFORM public.admin_adjust_points(u1, 730, 'Ajuste Manual Solicitado');
  ELSE
    RAISE NOTICE 'Usuário Yagompiazzacwb@hotmail.com não encontrado';
  END IF;

  -- Adiciona 1520 pontos para o segundo usuário
  IF u2 IS NOT NULL THEN
    PERFORM public.admin_adjust_points(u2, 1520, 'Ajuste Manual Solicitado');
  ELSE
    RAISE NOTICE 'Usuário Yagomeirapiazza@gmail.com não encontrado';
  END IF;
END $$;