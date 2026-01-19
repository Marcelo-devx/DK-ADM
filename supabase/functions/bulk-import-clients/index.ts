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
    const { clients } = await req.json();

    if (!clients || !Array.isArray(clients) || clients.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhum cliente fornecido.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    };

    for (const client of clients) {
      try {
        if (!client.email) {
            throw new Error("Email é obrigatório");
        }

        // Separa Nome de Sobrenome para metadados (Pega primeira palavra como nome, restante como sobrenome)
        const nameParts = (client.full_name || '').trim().split(' ');
        const firstName = nameParts[0] || 'Cliente';
        const lastName = nameParts.slice(1).join(' ') || '';

        // 1. Criar usuário no Auth
        const password = client.password ? String(client.password) : "123456";

        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: client.email,
          password: password,
          email_confirm: true,
          user_metadata: {
            first_name: firstName,
            last_name: lastName
          }
        });

        let userId = authData.user?.id;

        if (authError) {
            results.failed++;
            results.errors.push(`${client.email}: Usuário já cadastrado ou erro no Auth.`);
            continue; 
        }

        // 2. Atualizar tabela de profiles com dados extras
        if (userId) {
            const updateData: any = {
                first_name: firstName,
                last_name: lastName,
                date_of_birth: client.date_of_birth || null,
                phone: client.phone ? String(client.phone) : null,
                cep: client.cep ? String(client.cep) : null,
                street: client.street,
                number: client.number ? String(client.number) : null,
                complement: client.complement,
                neighborhood: client.neighborhood,
                city: client.city,
                state: client.state,
                updated_at: new Date().toISOString()
            };

            // Remove campos undefined que não queremos limpar
            Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

            const { error: profileError } = await supabaseAdmin
                .from('profiles')
                .update(updateData)
                .eq('id', userId);

            if (profileError) {
                console.error(`Erro ao atualizar perfil de ${client.email}:`, profileError);
            }
        }

        results.success++;

      } catch (err: any) {
        console.error(`Erro ao importar ${client.email}:`, err);
        results.failed++;
        results.errors.push(`${client.email || 'Desconhecido'}: ${err.message}`);
      }
    }

    return new Response(
      JSON.stringify({ 
        message: `Processamento concluído. Sucesso: ${results.success}, Falhas: ${results.failed}`,
        details: results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Erro geral na importação:', error);
    return new Response(
      JSON.stringify({ error: 'Falha interna na função.', details: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})