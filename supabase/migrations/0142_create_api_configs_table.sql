-- Create api_configs table for dynamic API management
CREATE TABLE IF NOT EXISTS public.api_configs (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    method TEXT NOT NULL CHECK (method IN ('GET', 'POST', 'PUT', 'DELETE')),
    path TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.api_configs ENABLE ROW LEVEL SECURITY;

-- Admin policies
CREATE POLICY "Admins can manage api_configs" ON public.api_configs
    FOR ALL
    USING (( SELECT profiles.role FROM profiles WHERE profiles.id = auth.uid()) = 'adm'::text);

-- Public read policy for documentation
CREATE POLICY "Public can read active api_configs" ON public.api_configs
    FOR SELECT
    USING (is_active = true);