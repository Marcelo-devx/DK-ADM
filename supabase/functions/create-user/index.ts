// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const FN = 'create-user'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method === 'GET') {
    return new Response(JSON.stringify({ status: 'ok' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  }

  try {
    const body = await req.json()
    const { email, password, first_name, last_name, cpf_cnpj, phone, gender } = body

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'email e password são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`[${FN}] Criando usuário: ${email}`)

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    const { data: createdUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name, last_name, phone, cpf_cnpj, gender },
    })

    if (createError) {
      console.error(`[${FN}] Erro ao criar usuário`, createError)
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userId = createdUser?.user?.id
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Falha ao obter ID do usuário' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
      id: userId,
      first_name: first_name || null,
      last_name: last_name || null,
      cpf_cnpj: cpf_cnpj || null,
      phone: phone || null,
      gender: gender || null,
      role: 'user',
      force_pix_on_next_purchase: true,
      is_credit_card_enabled: false,
    }, { onConflict: 'id' })

    if (profileError) {
      console.error(`[${FN}] Erro ao criar perfil`, profileError)
    }

    console.log(`[${FN}] Usuário criado com sucesso: ${userId}`)

    return new Response(JSON.stringify({ success: true, id: userId, email }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error(`[${FN}] Unexpected error:`, error?.message || String(error))
    return new Response(JSON.stringify({ error: error?.message || 'Erro interno' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
