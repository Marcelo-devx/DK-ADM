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

        // 1. Criar usuário no Auth (ou retornar se já existe)
        // Se a senha não vier na planilha, define uma padrão '123456'
        const password = client.password ? String(client.password) : "123456";

        // Tenta criar o usuário
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: client.email,
          password: password,
          email_confirm: true,
          user_metadata: {
            first_name: client.first_name,
            last_name: client.last_name
          }
        });

        let userId = authData.user?.id;

        // Se der erro porque já existe, tentamos buscar o ID dele para atualizar o perfil mesmo assim
        if (authError) {
            // Se o erro for "User already registered", buscamos o usuário
            // Nota: createUser não retorna o ID se falhar, então precisamos listar ou assumir falha se não quisermos atualizar existentes
            console.log(`Usuário ${client.email}: ${authError.message}`);
            
            // Opcional: Se quiser atualizar dados de usuários já existentes, descomente abaixo.
            // Por segurança na importação em massa, vamos contar como falha/existente para não sobrescrever dados sensíveis sem querer.
            results.failed++;
            results.errors.push(`${client.email}: Usuário já cadastrado.`);
            continue; 
        }

        // 2. Atualizar tabela de profiles com dados extras (telefone, endereço)
        if (userId) {
            // Aguarda um pouco para garantir que o trigger handle_new_user rodou
            // (Embora o update abaixo deva funcionar mesmo se rodar milissegundos depois)
            
            const updateData: any = {
                first_name: client.first_name,
                last_name: client.last_name,
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

            // Remove campos undefined/null que não queremos limpar
            Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

            const { error: profileError } = await supabaseAdmin
                .from('profiles')
                .update(updateData)
                .eq('id', userId);

            if (profileError) {
                console.error(`Erro ao atualizar perfil de ${client.email}:`, profileError);
                // Não conta como falha total pois o login foi criado
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