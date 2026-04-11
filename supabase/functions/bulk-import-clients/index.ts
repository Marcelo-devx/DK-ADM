// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

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

// Extrai UUID de forma robusta do retorno do RPC (pode vir como string, objeto ou array)
function extractUUID(data: any): string | null {
  if (!data) return null;
  if (typeof data === 'string') return data;
  if (Array.isArray(data)) {
    if (data.length === 0) return null;
    const first = data[0];
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object') {
      // Tenta pegar o valor da chave get_user_id_by_email ou qualquer valor UUID
      if (first.get_user_id_by_email) return first.get_user_id_by_email;
      const vals = Object.values(first);
      if (vals.length > 0 && typeof vals[0] === 'string') return vals[0] as string;
    }
    return null;
  }
  if (typeof data === 'object') {
    if (data.get_user_id_by_email) return data.get_user_id_by_email;
    const vals = Object.values(data);
    if (vals.length > 0 && typeof vals[0] === 'string') return vals[0] as string;
  }
  return null;
}

// Aguarda um tempo em ms (para dar tempo ao trigger handle_new_user criar o perfil)
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: buildCorsHeaders(req) })
  }

  const corsHeaders = buildCorsHeaders(req);

  try {
    const { clients } = await req.json();

    if (!clients || !Array.isArray(clients) || clients.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhum cliente fornecido.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[bulk-import-clients] Iniciando importação de ${clients.length} clientes`);

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
        console.log(`[bulk-import-clients] Processando: ${email}`);

        // Monta os campos a atualizar no perfil
        const nameParts = (client.full_name || '').trim().split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        const fieldsToUpdate: Record<string, any> = {};

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

        // Salva o email também na coluna email do perfil (para facilitar buscas)
        fieldsToUpdate.email = email;
        fieldsToUpdate.updated_at = new Date().toISOString();

        // NOTA: NÃO incluímos created_at aqui pois é controlado pelo banco.
        // O campo client_since da planilha não tem coluna correspondente em profiles.

        const password = client.password ? String(client.password) : "123456";

        // Tenta criar o usuário no auth
        const { data: createdData, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: email,
          password: password,
          email_confirm: true,
          user_metadata: { first_name: firstName, last_name: lastName }
        });

        let userId: string | null = null;
        let isNewUser = false;

        if (createError) {
          // Usuário já existe (status 422 ou mensagem "already registered")
          if (
            createError.message?.toLowerCase().includes("already registered") ||
            createError.message?.toLowerCase().includes("already been registered") ||
            (createError as any).status === 422
          ) {
            console.log(`[bulk-import-clients] Usuário já existe: ${email}, buscando ID via RPC`);

            const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('get_user_id_by_email', { user_email: email });

            if (rpcError) {
              console.error(`[bulk-import-clients] Erro no RPC get_user_id_by_email para ${email}:`, rpcError.message);
              throw new Error(`Erro ao buscar ID do usuário existente: ${rpcError.message}`);
            }

            userId = extractUUID(rpcData);
            console.log(`[bulk-import-clients] ID extraído do RPC para ${email}: ${userId}`);

            if (!userId) {
              throw new Error(`Usuário ${email} existe no auth mas ID não foi encontrado via RPC.`);
            }
          } else {
            console.error(`[bulk-import-clients] Erro ao criar usuário ${email}:`, createError.message);
            throw createError;
          }
        } else {
          userId = createdData?.user?.id ?? null;
          isNewUser = true;
          console.log(`[bulk-import-clients] Novo usuário criado: ${email}, ID: ${userId}`);
        }

        if (!userId) throw new Error(`ID do usuário não identificado para ${email}.`);

        if (isNewUser) {
          // Para novos usuários: o trigger handle_new_user já criou o perfil automaticamente.
          // Aguardamos um breve momento para garantir que o trigger executou antes do update.
          await sleep(300);

          // Atualiza o perfil criado pelo trigger com os dados da planilha
          const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update(fieldsToUpdate)
            .eq('id', userId);

          if (updateError) {
            console.error(`[bulk-import-clients] Erro ao atualizar perfil novo de ${email}:`, updateError.message);
            // Tenta upsert como fallback caso o trigger ainda não tenha criado o perfil
            const { error: upsertError } = await supabaseAdmin
              .from('profiles')
              .upsert({ id: userId, ...fieldsToUpdate }, { onConflict: 'id' });

            if (upsertError) {
              console.error(`[bulk-import-clients] Erro no upsert fallback para ${email}:`, upsertError.message);
              throw upsertError;
            }
          }

          results.created++;
          console.log(`[bulk-import-clients] ✅ Criado: ${email}`);
        } else {
          // Para usuários existentes: atualiza apenas os campos preenchidos
          const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update(fieldsToUpdate)
            .eq('id', userId);

          if (updateError) {
            console.error(`[bulk-import-clients] Erro ao atualizar perfil existente de ${email}:`, updateError.message);
            throw updateError;
          }

          results.updated++;
          console.log(`[bulk-import-clients] ✅ Atualizado: ${email}`);
        }

      } catch (err: any) {
        results.failed++;
        const errMsg = `${client.email || 'Linha desconhecida'}: ${err.message}`;
        results.errors.push(errMsg);
        console.error(`[bulk-import-clients] ❌ Falha:`, errMsg);
      }
    }

    console.log(`[bulk-import-clients] Concluído. Criados: ${results.created}, Atualizados: ${results.updated}, Falhas: ${results.failed}`);

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
  } catch (error: any) {
    console.error(`[bulk-import-clients] Erro interno fatal:`, error.message);
    return new Response(
      JSON.stringify({ error: 'Falha interna na função.', details: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
