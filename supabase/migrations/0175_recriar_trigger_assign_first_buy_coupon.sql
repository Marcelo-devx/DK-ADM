-- Recriar o trigger para garantir que está vinculado corretamente
-- à função atualizada de atribuição de cupom de primeira compra

-- Remover trigger antigo se existir
DROP TRIGGER IF EXISTS on_profile_created_assign_first_buy ON public.profiles;

-- Recriar o trigger vinculado à função atualizada
CREATE TRIGGER on_profile_created_assign_first_buy
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.assign_first_buy_coupon_on_signup();
