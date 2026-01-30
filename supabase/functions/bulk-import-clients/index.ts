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
      created: 0,
      updated: 0,
      failed: 0,
      errors: [] as string[]
    };

    for (const client of clients) {
      try {
        if (!client.email) throw new Error("Email é obrigatório");

        const email = client.email.trim().toLowerCase();
        
        // Dados brutos da planilha
        const nameParts = (client.full_name || '').trim().split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        // Objeto com os campos que vieram da planilha (limpando vazios)
        // A lógica é: Se veio na planilha, queremos usar. Se veio vazio, ignoramos para não apagar dados existentes.
        const fieldsToUpdate: any = {};
        
        if (firstName) fieldsToUpdate.first_name = firstName;
        if (lastName) fieldsToUpdate.last_name = lastName;
        if (client.phone) fieldsToUpdate.phone = String(client.phone);
        if (client.cpf_cnpj) fieldsToUpdate.cpf_cnpj = String(client.cpf_cnpj);
        if (client.gender) fieldsToUpdate.gender = client.gender;
        if (client.date_of_birth) fieldsToUpdate.date_of_birth = client.date_of_birth;
        
        // Endereço
        if (client.cep) fieldsToUpdate.cep = String(client.cep);
        if (client.street) fieldsToUpdate.street = client.street;
        if (client.number) fieldsToUpdate.number = String(client.number);
        if (client.complement) fieldsToUpdate.complement = client.complement;
        if (client.neighborhood) fieldsToUpdate.neighborhood = client.neighborhood;
        if (client.city) fieldsToUpdate.city = client.city;
        if (client.state) fieldsToUpdate.state = client.state;

        // Data de atualização
        fieldsToUpdate.updated_at = new Date().toISOString();

        // 1. Verifica se o usuário já existe no Auth
        // Nota: listUsers é paginado, mas getUserByEmail não é exposto diretamente na API admin de forma simples sem ID
        // Vamos tentar criar. Se der erro de "já existe", então atualizamos.
        
        let userId = null;
        let isNewUser = false;

        // Tentativa de Criação
        const password = client.password ? String(client.password) : "123456";
        
        // Tenta criar usuário
        const { data: createdData, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true,
            user_metadata: { first_name: firstName, last_name: lastName }
        });

        if (createError) {
            // Se o erro for "User already registered", buscamos o ID dele para atualizar
            if (createError.message?.includes("already registered") || createError.status === 422) {
                // Como não temos getUser(email) direto eficiente sem escopo, usamos uma RPC auxiliar segura ou listUsers filtrado
                // Para simplificar e garantir performance, vamos assumir que precisamos achar esse ID.
                // Uma maneira robusta é tentar um "invite" ou usar uma função Postgres se disponível.
                // Mas aqui, vamos usar listUsers com filtro (funciona bem para volumes moderados)
                // OBS: Supabase Admin API não tem "getByEmail" direto documentado publicamente no JS client moderno além do list.
                // Truque: Tentar logar não funciona (admin context).
                // Solução: Usar uma query na tabela `auth.users` não é permitido via API Client padrão (schema auth é protegido).
                
                // Vamos usar a RPC `get_user_id_by_email` que já criamos em passos anteriores.
                const { data: existingId, error: rpcError } = await supabaseAdmin.rpc('get_user_id_by_email', { user_email: email });
                
                if (rpcError || !existingId) {
                    throw new Error("Usuário existe mas não foi possível recuperar ID para atualização.");
                }
                userId = existingId;
            } else {
                throw createError;
            }
        } else {
            userId = createdData.user?.id;
            isNewUser = true;
        }

        if (!userId) throw new Error("ID do usuário não identificado.");

        // 2. Atualizar Perfil (Upsert/Update)
        // Se for novo, inserimos tudo.
        // Se for antigo, fazemos update apenas dos campos que vieram no excel (fieldsToUpdate).
        
        if (isNewUser) {
            // Se o cliente é novo, podemos forçar a data de criação se fornecida
            if (client.client_since) {
                fieldsToUpdate.created_at = client.client_since;
            }
            
            const { error: profileError } = await supabaseAdmin
                .from('profiles')
                .upsert({ id: userId, ...fieldsToUpdate }); // Upsert garante criação
            
            if (profileError) throw profileError;
            results.created++;
        } else {
            // Se já existe, fazemos UPDATE para não sobrescrever campos não mencionados com null
            // O objeto fieldsToUpdate já contém apenas as chaves que tinham valor no Excel
            const { error: profileError } = await supabaseAdmin
                .from('profiles')
                .update(fieldsToUpdate)
                .eq('id', userId);

            if (profileError) throw profileError;
            results.updated++;
        }

      } catch (err: any) {
        results.failed++;
        results.errors.push(`${client.email || 'Linha desconhecida'}: ${err.message}`);
      }
    }

    return new Response(
      JSON.stringify({ 
        message: `Processamento concluído.`,
        details: results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Falha interna na função.', details: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})