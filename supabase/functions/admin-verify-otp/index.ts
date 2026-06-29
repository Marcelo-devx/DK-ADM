// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const FN = 'admin-verify-otp'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { email, code, redirect_to } = body

    if (!email || !code) {
      return new Response(JSON.stringify({ error: 'E-mail e código são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    // Buscar código válido na tabela email_links
    const now = new Date().toISOString()
    const { data: link, error: linkError } = await supabaseAdmin
      .from('email_links')
      .select('id, email, token, used, expires_at, user_id')
      .eq('email', email.toLowerCase().trim())
      .eq('token', code.trim())
      .eq('used', false)
      .gt('expires_at', now)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (linkError) {
      console.error(`[${FN}] Erro ao buscar código:`, linkError)
      return new Response(JSON.stringify({ error: 'Erro interno ao validar código' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!link) {
      console.log(`[${FN}] Código inválido, expirado ou já usado para: ${email}`)
      return new Response(JSON.stringify({ error: 'Código inválido, expirado ou já utilizado' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Marcar código como usado
    await supabaseAdmin
      .from('email_links')
      .update({ used: true })
      .eq('id', link.id)

    // Gerar magic link para autenticar o usuário sem senha
    const redirectTo = redirect_to || `${Deno.env.get('SUPABASE_URL')?.replace('https://', 'https://').split('.supabase')[0]}`

    const { data: linkData, error: genError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: email.toLowerCase().trim(),
      options: {
        redirectTo: redirect_to || 'https://dkcwb.com/meus-pedidos',
      },
    })

    if (genError || !linkData?.properties?.action_link) {
      console.error(`[${FN}] Erro ao gerar magic link:`, genError)
      return new Response(JSON.stringify({ error: 'Erro ao gerar sessão de acesso' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`[${FN}] Código válido e sessão gerada para: ${email}`)

    return new Response(JSON.stringify({
      success: true,
      action_link: linkData.properties.action_link,
    }), {
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
