// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const FN = 'forgot-password'

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
    const { email } = body

    if (!email) {
      return new Response(JSON.stringify({ error: 'email é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`[${FN}] Solicitação de reset de senha para: ${email}`)

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    // Buscar configurações do site
    const { data: settings } = await supabaseAdmin
      .from('app_settings')
      .select('key, value')
      .in('key', ['site_url'])

    const siteUrl = settings?.find(s => s.key === 'site_url')?.value || 'http://localhost:8080'

    // Gerar link de reset via Supabase Admin
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: `${siteUrl}/reset-password`,
      },
    })

    if (linkError) {
      console.error(`[${FN}] Erro ao gerar link de reset`, linkError)
      // Retorna sucesso mesmo com erro para não revelar se o email existe
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const resetLink = linkData?.properties?.action_link
    if (!resetLink) {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Enviar email via Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'noreply@example.com'

    if (resendApiKey) {
      const html = `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
          <h2 style="color:#111;">Redefinição de senha</h2>
          <p style="color:#555;font-size:15px;">Recebemos uma solicitação para redefinir a senha da sua conta.</p>
          <p style="color:#555;font-size:15px;">Clique no botão abaixo para criar uma nova senha:</p>
          <div style="text-align:center;margin:32px 0;">
            <a href="${resetLink}" style="background:#111;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:600;">Redefinir senha</a>
          </div>
          <p style="color:#888;font-size:13px;">Este link expira em 1 hora. Se você não solicitou a redefinição, ignore este e-mail.</p>
          <p style="color:#aaa;font-size:12px;word-break:break-all;">Ou acesse: ${resetLink}</p>
        </div>
      `

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [email],
          subject: '🔐 Redefinição de senha',
          html,
        }),
      })

      console.log(`[${FN}] Email de reset enviado para: ${email}`)
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error(`[${FN}] Unexpected error:`, error?.message || String(error))
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
