// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

// Build CORS headers per-request so we can echo the request origin when credentials are used.
// Browsers reject Access-Control-Allow-Origin: '*' together with Access-Control-Allow-Credentials: 'true',
// so we must return the exact origin that made the request and include Vary: Origin.
function buildCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: buildCorsHeaders(req) })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Verificação de Admin
    const authHeader = req.headers.get('Authorization')!;
    const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
    );
    
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error('Falha na autenticação.');

    const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'adm') {
        return new Response(JSON.stringify({ error: 'Acesso negado.' }), { status: 403, headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' } });
    }

    // Recebe os novos campos
    const { email, password, full_name, cpf_cnpj, gender, phone } = await req.json();
    
    if (!email || !password) {
      throw new Error("E-mail e senha são obrigatórios.");
    }

    // Processa nome
    const nameParts = (full_name || '').trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // 1. Cria usuário no Auth
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName
      }
    });

    if (createError) throw createError;

    // 2. Atualiza perfil com dados extras
    if (newUser.user) {
        const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update({
                first_name: firstName,
                last_name: lastName,
                cpf_cnpj: cpf_cnpj || null,
                gender: gender || null,
                phone: phone || null
            })
            .eq('id', newUser.user.id);

        if (updateError) console.error("Erro ao atualizar perfil:", updateError);
    }

    return new Response(JSON.stringify({ message: `Cliente ${email} cadastrado com sucesso!` }), {
      headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Falha ao processar criação.', details: error.message }),
      {
        headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})