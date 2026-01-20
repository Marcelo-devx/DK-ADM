-- 1. Tabela para gerenciar as opções de troca (Pontos -> Desconto)
CREATE TABLE public.loyalty_redemption_rules (
    id SERIAL PRIMARY KEY,
    points_cost INTEGER NOT NULL,
    discount_value NUMERIC NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inserir as regras padrão solicitadas
INSERT INTO public.loyalty_redemption_rules (points_cost, discount_value) VALUES
(50, 5),
(100, 10),
(200, 20),
(500, 50),
(700, 70),
(900, 90),
(1100, 110),
(1300, 130),
(1500, 150);

-- Habilitar segurança
ALTER TABLE public.loyalty_redemption_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read redemption rules" ON public.loyalty_redemption_rules FOR SELECT USING (true);
CREATE POLICY "Admin manage redemption rules" ON public.loyalty_redemption_rules USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'adm'
);

-- 2. Inserir configurações globais de pontuação (Se já existirem, não faz nada)
INSERT INTO public.app_settings (key, value) VALUES
('loyalty_birthday_bonus', '100'),
('loyalty_referral_bonus', '50')
ON CONFLICT (key) DO NOTHING;

-- Configurações de Ticket Alto
INSERT INTO public.app_settings (key, value) VALUES
('loyalty_ticket_threshold', '500'), -- Valor mínimo para ganhar bônus
('loyalty_ticket_bonus', '10')       -- Pontos ganhos
ON CONFLICT (key) DO NOTHING;

-- Configurações de Recorrência Mensal
INSERT INTO public.app_settings (key, value) VALUES
('loyalty_recurrence_2nd', '5'),
('loyalty_recurrence_3rd', '10'),
('loyalty_recurrence_4th', '15')
ON CONFLICT (key) DO NOTHING;