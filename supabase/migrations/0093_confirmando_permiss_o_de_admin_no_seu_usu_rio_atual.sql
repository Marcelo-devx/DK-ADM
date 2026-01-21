UPDATE public.profiles
SET role = 'adm'
WHERE id = auth.uid();