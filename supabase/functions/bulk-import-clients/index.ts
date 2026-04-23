// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function extractUUID(data: any): string | null {
  if (!data) return null;
  if (typeof data === 'string') return data;
  if (Array.isArray(data)) {
    if (data.length === 0) return null;
    const first = data[0];
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object') {
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

async function processClient(supabaseAdmin: any, client: any): Promise<{ success: boolean; isNew: boolean; error?: string }> {
  if (!client.email) throw new Error("Email é obrigatório");

  const email = client.email.trim().toLowerCase();

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
  if (client.cep) fieldsToUpdate.cep = String(client.cep);
  if (client.street) fieldsToUpdate.street = client.street;
  if (client.number) fieldsToUpdate.number = String(client.number);
  if (client.complement) fieldsToUpdate.complement = client.complement;
  if (client.neighborhood) fieldsToUpdate.neighborhood = client.neighborhood;
  if (client.city) fieldsToUpdate.city = client.city;
  if (client.state) fieldsToUpdate.state = client.state;
  fieldsToUpdate.email = email;
  fieldsToUpdate.updated_at = new Date().toISOString();
  // Clientes importados via planilha NÃO recebem o cupom de primeira compra
  fieldsToUpdate.skip_first_buy_coupon = true;

  const password = client.password ? String(client.password) : "123456";

  // Tenta criar o usuário no auth
  // skip_first_buy_coupon=true no metadata garante que o trigger handle_new_user
  // crie o perfil já com esse flag, impedindo a atribuição do cupom PRIMEIRACOMPRA
  const { data: createdData, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: email,
    password: password,
    email_confirm: true,
    user_metadata: { first_name: firstName, last_name: lastName, skip_first_buy_coupon: true }
  });

  let userId: string | null = null;
  let isNewUser = false;

  if (createError) {
    const isAlreadyExists =
      createError.message?.toLowerCase().includes("already registered") ||
      createError.message?.toLowerCase().includes("already been registered") ||
      (createError as any).status === 422;

    if (isAlreadyExists) {
      console.log(`[bulk-import-clients] Usuário já existe: ${email}, buscando ID via RPC`);
      const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('get_user_id_by_email', { user_email: email });
      if (rpcError) throw new Error(`Erro ao buscar ID do usuário existente: ${rpcError.message}`);
      userId = extractUUID(rpcData);
      if (!userId) throw new Error(`Usuário ${email} existe no auth mas ID não foi encontrado via RPC.`);
    } else {
      throw createError;
    }
  } else {
    userId = createdData?.user?.id ?? null;
    isNewUser = true;
    console.log(`[bulk-import-clients] Novo usuário criado: ${email}, ID: ${userId}`);
  }

  if (!userId) throw new Error(`ID do usuário não identificado para ${email}.`);

  if (isNewUser) {
    // Aguarda o trigger handle_new_user criar o perfil
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Tenta update primeiro, depois upsert como fallback
  const { error: updateError } = await supabaseAdmin
    .from('profiles')
    .update(fieldsToUpdate)
    .eq('id', userId);

  if (updateError) {
    console.warn(`[bulk-import-clients] Update falhou para ${email}, tentando upsert:`, updateError.message);
    const { error: upsertError } = await supabaseAdmin
      .from('profiles')
      .upsert({ id: userId, ...fieldsToUpdate }, { onConflict: 'id' });
    if (upsertError) throw upsertError;
  }

  return { success: true, isNew: isNewUser };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    let body: any;
    try {
      body = await req.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Corpo da requisição inválido.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { clients } = body;

    if (!clients || !Array.isArray(clients) || clients.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhum cliente fornecido.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[bulk-import-clients] Iniciando importação de ${clients.length} clientes`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Variáveis de ambiente do Supabase não configuradas.');
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    const results = {
      created: 0,
      updated: 0,
      failed: 0,
      errors: [] as string[]
    };

    // Processa sequencialmente para evitar timeout em lotes grandes
    for (let i = 0; i < clients.length; i++) {
      const client = clients[i];
      try {
        const result = await processClient(supabaseAdmin, client);
        if (result.isNew) {
          results.created++;
          console.log(`[bulk-import-clients] ✅ Criado: ${client.email}`);
        } else {
          results.updated++;
          console.log(`[bulk-import-clients] ✅ Atualizado: ${client.email}`);
        }
      } catch (err: any) {
        results.failed++;
        const errMsg = `${client.email || 'Linha desconhecida'}: ${err?.message || 'Erro desconhecido'}`;
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
    );
  } catch (error: any) {
    console.error(`[bulk-import-clients] Erro interno fatal:`, error.message);
    return new Response(
      JSON.stringify({ error: 'Falha interna na função.', details: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
})