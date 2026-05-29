// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const FN = 'notify-back-in-stock'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── Template de e-mail ───────────────────────────────────────────────────────

function buildBackInStockEmail(params: {
  firstName: string
  productName: string
  variantName: string | null
  productUrl: string
  productImage: string | null
}): { subject: string; html: string } {
  const { firstName, productName, variantName, productUrl, productImage } = params
  const displayName = variantName ? `${productName} — ${variantName}` : productName
  const subject = `🎉 Voltou ao estoque: ${displayName}`

  const imageBlock = productImage
    ? `<div style="text-align:center;margin:20px 0;">
        <img src="${productImage}" alt="${productName}"
          style="max-width:200px;max-height:200px;object-fit:cover;border-radius:12px;border:1px solid #e8e8e8;" />
       </div>`
    : ''

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="padding:32px 40px;">

              <!-- Header -->
              <div style="text-align:center;margin-bottom:28px;">
                <div style="font-size:52px;margin-bottom:12px;">🎉</div>
                <h1 style="margin:0;font-size:24px;font-weight:700;color:#111;">Voltou ao estoque!</h1>
                <p style="margin:8px 0 0;font-size:15px;color:#555;">O produto que você reservou está disponível novamente.</p>
              </div>

              <!-- Saudação -->
              <p style="font-size:15px;color:#333;margin:0 0 16px;">Olá, <strong>${firstName}</strong>! 👋</p>
              <p style="font-size:15px;color:#555;margin:0 0 20px;line-height:1.6;">
                Boa notícia! O produto que você adicionou à sua lista de reservas acabou de voltar ao estoque no nosso site.
                Corra antes que esgote novamente! 🚀
              </p>

              <!-- Produto destaque -->
              <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:18px 20px;margin:0 0 20px;">
                ${imageBlock}
                <p style="margin:0;font-size:16px;font-weight:700;color:#111;text-align:center;">${displayName}</p>
              </div>

              <!-- CTA -->
              <div style="text-align:center;margin:28px 0;">
                <a href="${productUrl}"
                  style="display:inline-block;background:#111111;color:#ffffff;padding:14px 36px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:700;letter-spacing:0.3px;">
                  Comprar agora →
                </a>
              </div>

              <p style="font-size:13px;color:#888;text-align:center;line-height:1.6;margin:0 0 8px;">
                Ou acesse diretamente: <a href="${productUrl}" style="color:#111;word-break:break-all;">${productUrl}</a>
              </p>

              <hr style="border:none;border-top:1px solid #f0f0f0;margin:28px 0;">

              <p style="font-size:12px;color:#aaa;text-align:center;margin:0;">
                Você recebeu este e-mail porque reservou este produto em nosso site.<br>
                Este é um e-mail automático, por favor não responda.
              </p>

            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()

  return { subject, html }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } }
  )

  try {
    const body = await req.json()
    // product_id pode vir como number ou string
    const { product_id, variant_id } = body

    console.log(`[${FN}] Recebido disparo do banco`, { product_id, variant_id })

    if (!product_id) {
      return new Response(JSON.stringify({ error: 'product_id é obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 1. Buscar reservas ativas para esse produto/variante
    let query = supabaseAdmin
      .from('product_reservations')
      .select('id, user_id, product_name, product_image, variant_id, variant_name')
      .eq('product_id', product_id)
      .eq('status', 'active')

    if (variant_id) {
      query = query.eq('variant_id', variant_id)
    }

    const { data: reservations, error: resErr } = await query

    if (resErr) {
      console.error(`[${FN}] Erro ao buscar reservas`, { error: resErr.message })
      return new Response(JSON.stringify({ error: resErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!reservations || reservations.length === 0) {
      console.log(`[${FN}] Nenhuma reserva ativa para product_id=${product_id}`)
      return new Response(JSON.stringify({ message: 'Nenhuma reserva ativa', sent: 0 }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`[${FN}] Encontradas ${reservations.length} reservas ativas`)

    // 2. Buscar URL base do site
    const { data: siteUrlSetting } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', 'site_url')
      .maybeSingle()

    const siteUrl = siteUrlSetting?.value ?? 'https://dondk.com.br'

    // 3. Enviar e-mail para cada reserva
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'noreply@dondk.com.br'

    if (!resendApiKey) {
      console.error(`[${FN}] RESEND_API_KEY não configurada`)
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY não configurada' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let sent = 0
    let failed = 0

    for (const reservation of reservations) {
      // 3a. Buscar email e nome do usuário
      let customerEmail: string | null = null
      let firstName = 'Cliente'

      try {
        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(reservation.user_id)
        customerEmail = userData?.user?.email ?? null
      } catch (e) {
        console.warn(`[${FN}] Falha ao buscar email do auth para user ${reservation.user_id}`, { error: e?.message })
      }

      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('first_name, email')
        .eq('id', reservation.user_id)
        .maybeSingle()

      if (profile?.first_name) firstName = profile.first_name
      if (!customerEmail && profile?.email) customerEmail = profile.email

      if (!customerEmail) {
        console.warn(`[${FN}] Sem e-mail para user_id=${reservation.user_id}, pulando`)
        failed++
        continue
      }

      const productUrl = `${siteUrl}/product/${reservation.product_id}`

      const { subject, html } = buildBackInStockEmail({
        firstName,
        productName: reservation.product_name,
        variantName: reservation.variant_name ?? null,
        productUrl,
        productImage: reservation.product_image ?? null,
      })

      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: fromEmail, to: [customerEmail], subject, html }),
      })

      const resendData = await resendRes.json()

      if (!resendRes.ok) {
        console.error(`[${FN}] Falha ao enviar para ${customerEmail}`, { data: resendData })
        failed++
      } else {
        console.log(`[${FN}] E-mail enviado para ${customerEmail}`, { resend_id: resendData?.id })
        sent++

        // Gravar data/hora do envio do email na reserva
        await supabaseAdmin
          .from('product_reservations')
          .update({ email_notified_at: new Date().toISOString() })
          .eq('id', reservation.id)

        // Registrar no integration_logs
        await supabaseAdmin.from('integration_logs').insert({
          event_type: 'email_back_in_stock',
          status: 'success',
          response_code: 200,
          details: `Reserva ${reservation.id} | Produto: ${reservation.product_name} | Para: ${customerEmail} | Resend ID: ${resendData?.id}`,
        })
      }
    }

    console.log(`[${FN}] Concluído`, { sent, failed, total: reservations.length })

    return new Response(JSON.stringify({ success: true, sent, failed, total: reservations.length }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error(`[${FN}] Erro inesperado`, { error: error?.message || String(error) })
    return new Response(JSON.stringify({ error: error?.message || 'Erro interno' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
