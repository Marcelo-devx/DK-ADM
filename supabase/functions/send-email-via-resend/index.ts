// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const FN = 'send-email-via-resend'

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
    const { to, subject, type, code, resetLink, html } = body

    console.log(`[${FN}] Requisição recebida`, { to, subject, type })

    if (!to || !subject) {
      return new Response(JSON.stringify({ error: 'to e subject são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'noreply@example.com'

    console.log(`[${FN}] from: ${fromEmail} apiKey configured: ${!!resendApiKey}`)

    if (!resendApiKey) {
      console.error(`[${FN}] RESEND_API_KEY não configurada`)
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY não configurada' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Monta o HTML do email conforme o tipo
    let emailHtml = html || ''

    if (!emailHtml && type === 'otp') {
      emailHtml = `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
          <h2 style="color:#111;">Seu código de verificação</h2>
          <p style="color:#555;font-size:15px;">Use o código abaixo para confirmar sua identidade:</p>
          <div style="background:#f4f4f4;border-radius:8px;padding:24px;text-align:center;margin:24px 0;">
            <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#111;">${code}</span>
          </div>
          <p style="color:#888;font-size:13px;">Este código expira em 10 minutos. Não compartilhe com ninguém.</p>
        </div>
      `
    } else if (!emailHtml && type === 'password_reset') {
      emailHtml = `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
          <h2 style="color:#111;">Redefinição de senha</h2>
          <p style="color:#555;font-size:15px;">Clique no botão abaixo para redefinir sua senha:</p>
          <div style="text-align:center;margin:32px 0;">
            <a href="${resetLink}" style="background:#111;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:600;">Redefinir senha</a>
          </div>
          <p style="color:#888;font-size:13px;">Se você não solicitou a redefinição de senha, ignore este e-mail.</p>
          <p style="color:#aaa;font-size:12px;word-break:break-all;">Ou acesse: ${resetLink}</p>
        </div>
      `
    }

    if (!emailHtml) {
      emailHtml = `<p>${subject}</p>`
    }

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject,
        html: emailHtml,
      }),
    })

    const resendData = await resendResponse.json()

    if (!resendResponse.ok) {
      console.error(`[${FN}] Erro ao enviar via Resend`, { status: resendResponse.status, data: resendData })
      return new Response(JSON.stringify({ error: 'Falha ao enviar e-mail', details: resendData }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`[${FN}] E-mail enviado com sucesso`, { to, resend_id: resendData?.id })

    return new Response(JSON.stringify({ success: true, resend_id: resendData?.id }), {
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
