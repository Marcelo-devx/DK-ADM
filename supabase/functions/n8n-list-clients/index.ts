// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Validação do Token
    const authHeader = req.headers.get('Authorization');
    const secretToken = authHeader?.replace('Bearer ', '');
    
    const { data: setting } = await supabaseAdmin.from('app_settings').select('value').eq('key', 'n8n_integration_token').single();
    if (!setting?.value || secretToken !== setting.value) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Busca Perfis
    const { data: profiles, error } = await supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name, phone, points, role, created_at')
        .order('created_at', { ascending: false });

    if (error) throw error;

    // Busca usuários do Auth para pegar o email (opcional, pois profiles deveria ter email se sincronizado, mas o auth é a fonte da verdade)
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
    const emailMap = new Map(users.map(u => [u.id, u.email]));

    const result = profiles.map(p => ({
        id: p.id,
        name: `${p.first_name || ''} ${p.last_name || ''}`.trim(),
        email: emailMap.get(p.id) || null,
        phone: p.phone,
        points: p.points,
        role: p.role,
        created_at: p.created_at
    }));

    return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
})