// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const FN = 'admin-generate-otp'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    // Verificar se é admin
    const token = authHeader.replace('Bearer ', '').trim()
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token)

    if (userError || !userData?.user?.id) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .single()

    if (!['adm', 'gerente_geral'].includes(profile?.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const { email } = body

    if (!email) {
      return new Response(JSON.stringify({ error: 'E-mail é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Gerar código de 6 dígitos
    const code = String(Math.floor(100000 + Math.random() * 900000))

    // Calcular expiração: 10 minutos
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    // Buscar user_id pelo e-mail diretamente na tabela profiles
    // (evita o RPC get_user_id_by_email que requer auth.uid() — incompatível com service role)
    const { data: profileData } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle()

    const userId = profileData?.id

    // Inserir na tabela email_links (mesmo fluxo do sistema normal)
    const { error: insertError } = await supabaseAdmin
      .from('email_links')
      .insert({
        email,
        token: code,
        type: 'signup_otp',
        used: false,
        expires_at: expiresAt,
        user_id: userId || null,
      })

    if (insertError) {
      console.error(`[${FN}] Erro ao inserir código:`, insertError)
      return new Response(JSON.stringify({ error: 'Erro ao gerar código', details: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`[${FN}] Código OTP gerado manualmente pelo admin ${userData.user.id} para e-mail: ${email}`)

    return new Response(JSON.stringify({ success: true, code, expires_at: expiresAt }), {
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
