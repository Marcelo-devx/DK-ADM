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

        // SE TIVER DATA DE CLIENTE DESDE, USA ELA COMO DATA DE CRIAÇÃO DO PERFIL
        if (client.client_since) {
            fieldsToUpdate.created_at = client.client_since;
        }

        fieldsToUpdate.updated_at = new Date().toISOString();

        let userId = null;
        let isNewUser = false;

        const password = client.password ? String(client.password) : "123456";
        
        const { data: createdData, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true,
            user_metadata: { first_name: firstName, last_name: lastName }
        });

        if (createError) {
            if (createError.message?.includes("already registered") || createError.status === 422) {
                const { data: existingId, error: rpcError } = await supabaseAdmin.rpc('get_user_id_by_email', { user_email: email });
                if (rpcError || !existingId) throw new Error("Usuário existe mas erro ao recuperar ID.");
                userId = existingId;
            } else {
                throw createError;
            }
        } else {
            userId = createdData.user?.id;
            isNewUser = true;
        }

        if (!userId) throw new Error("ID do usuário não identificado.");

        // Atualizar Perfil
        if (isNewUser) {
            const { error: profileError } = await supabaseAdmin
                .from('profiles')
                .upsert({ id: userId, ...fieldsToUpdate });
            
            if (profileError) throw profileError;
            results.created++;
        } else {
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