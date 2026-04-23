// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FN = 'send-order-email'
// v2 - redeploy

// ─── Helpers de formatação ────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo'
  })
}

// ─── Templates HTML ───────────────────────────────────────────────────────────

function buildItemsTable(items: any[]): string {
  if (!items || items.length === 0) return ''
  const rows = items.map(item => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#333;">${item.name_at_purchase || item.name || 'Produto'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#555;text-align:center;">${item.quantity}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:14px;color:#333;text-align:right;">${formatCurrency(Number(item.price_at_purchase || item.price || 0))}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:14px;font-weight:600;color:#333;text-align:right;">${formatCurrency(Number(item.price_at_purchase || item.price || 0) * Number(item.quantity || 1))}</td>
    </tr>
  `).join('')

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:16px 0;border:1px solid #e8e8e8;border-radius:8px;overflow:hidden;">
      <thead>
        <tr style="background:#f8f8f8;">
          <th style="padding:10px 12px;font-size:12px;font-weight:700;color:#888;text-align:left;text-transform:uppercase;letter-spacing:0.5px;">Produto</th>
          <th style="padding:10px 12px;font-size:12px;font-weight:700;color:#888;text-align:center;text-transform:uppercase;letter-spacing:0.5px;">Qtd</th>
          <th style="padding:10px 12px;font-size:12px;font-weight:700;color:#888;text-align:right;text-transform:uppercase;letter-spacing:0.5px;">Preço</th>
          <th style="padding:10px 12px;font-size:12px;font-weight:700;color:#888;text-align:right;text-transform:uppercase;letter-spacing:0.5px;">Total</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `
}

function buildTotalsBlock(order: any): string {
  const shipping = Number(order.shipping_cost || 0)
  const discount = Number(order.coupon_discount || 0)
  const donation = Number(order.donation_amount || 0)
  const total = Number(order.total_price || 0)

  let rows = ''
  if (shipping > 0) rows += `<tr><td style="padding:4px 0;font-size:14px;color:#555;">Frete</td><td style="padding:4px 0;font-size:14px;color:#555;text-align:right;">${formatCurrency(shipping)}</td></tr>`
  if (discount > 0) rows += `<tr><td style="padding:4px 0;font-size:14px;color:#22c55e;">Desconto (cupom)</td><td style="padding:4px 0;font-size:14px;color:#22c55e;text-align:right;">- ${formatCurrency(discount)}</td></tr>`
  if (donation > 0) rows += `<tr><td style="padding:4px 0;font-size:14px;color:#555;">Doação</td><td style="padding:4px 0;font-size:14px;color:#555;text-align:right;">${formatCurrency(donation)}</td></tr>`

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
      <tbody>
        ${rows}
        <tr>
          <td style="padding:10px 0 4px;font-size:16px;font-weight:700;color:#111;border-top:2px solid #e8e8e8;">Total</td>
          <td style="padding:10px 0 4px;font-size:16px;font-weight:700;color:#111;text-align:right;border-top:2px solid #e8e8e8;">${formatCurrency(total)}</td>
        </tr>
      </tbody>
    </table>
  `
}

function buildAddressBlock(addr: any): string {
  if (!addr) return ''
  const parts = [
    addr.street && addr.number ? `${addr.street}, ${addr.number}` : addr.street,
    addr.complement,
    addr.neighborhood,
    addr.city && addr.state ? `${addr.city} - ${addr.state}` : addr.city,
    addr.cep
  ].filter(Boolean)
  if (parts.length === 0) return ''
  return `
    <div style="background:#f8f8f8;border-radius:8px;padding:14px 16px;margin:16px 0;font-size:14px;color:#555;line-height:1.7;">
      <strong style="color:#333;display:block;margin-bottom:4px;">📍 Endereço de entrega</strong>
      ${parts.join('<br>')}
    </div>
  `
}

function wrapEmail(content: string, orderId: number): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pedido #${orderId}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="padding:32px 40px;">
              ${content}
              <hr style="border:none;border-top:1px solid #f0f0f0;margin:28px 0;">
              <p style="font-size:12px;color:#aaa;text-align:center;margin:0;">
                Este é um e-mail automático, por favor não responda.<br>
                Pedido #${orderId}
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
}

// ─── Template: Compra Confirmada ──────────────────────────────────────────────

function buildOrderPaidEmail(order: any, items: any[], firstName: string): { subject: string; html: string } {
  const subject = `✅ Pedido #${order.id} confirmado — aguardando coleta`
  const html = wrapEmail(`
    <div style="text-align:center;margin-bottom:28px;">
      <div style="font-size:48px;margin-bottom:12px;">✅</div>
      <h1 style="margin:0;font-size:24px;font-weight:700;color:#111;">Compra confirmada!</h1>
      <p style="margin:8px 0 0;font-size:15px;color:#555;">Seu pagamento foi recebido com sucesso.</p>
    </div>

    <p style="font-size:15px;color:#333;margin:0 0 20px;">Olá, <strong>${firstName}</strong>! 👋</p>
    <p style="font-size:15px;color:#555;margin:0 0 20px;line-height:1.6;">
      Recebemos o seu pagamento e seu pedido já está <strong>aguardando coleta</strong> pelo nosso time de entrega. Em breve você receberá mais atualizações!
    </p>

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 16px;margin:0 0 20px;font-size:14px;color:#166534;">
      📦 <strong>Pedido #${order.id}</strong> — ${formatDate(order.created_at)}
    </div>

    ${buildItemsTable(items)}
    ${buildTotalsBlock(order)}
    ${buildAddressBlock(order.shipping_address)}

    <p style="font-size:14px;color:#555;margin:20px 0 0;line-height:1.6;">
      Qualquer dúvida, entre em contato com a gente. Obrigado pela sua compra! 🙏
    </p>
  `, order.id)

  return { subject, html }
}

// ─── Template: Pedido Embalado ────────────────────────────────────────────────

function buildOrderPackedEmail(order: any, items: any[], firstName: string): { subject: string; html: string } {
  const subject = `📦 Pedido #${order.id} embalado — em breve entrará em rota`
  const html = wrapEmail(`
    <div style="text-align:center;margin-bottom:28px;">
      <div style="font-size:48px;margin-bottom:12px;">📦</div>
      <h1 style="margin:0;font-size:24px;font-weight:700;color:#111;">Pedido embalado!</h1>
      <p style="margin:8px 0 0;font-size:15px;color:#555;">Seu pedido está pronto e logo entrará em rota.</p>
    </div>

    <p style="font-size:15px;color:#333;margin:0 0 20px;">Olá, <strong>${firstName}</strong>! 👋</p>
    <p style="font-size:15px;color:#555;margin:0 0 20px;line-height:1.6;">
      Boa notícia! Seu pedido <strong>#${order.id}</strong> já foi <strong>embalado</strong> com todo o cuidado e em breve entrará na fase de rota de entrega. Fique de olho nas próximas atualizações!
    </p>

    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:14px 16px;margin:0 0 20px;font-size:14px;color:#92400e;">
      🚚 Seu pedido está sendo preparado para sair para entrega em breve.
    </div>

    ${buildItemsTable(items)}
    ${buildTotalsBlock(order)}

    <p style="font-size:14px;color:#555;margin:20px 0 0;line-height:1.6;">
      Obrigado pela paciência e pela confiança! 🙏
    </p>
  `, order.id)

  return { subject, html }
}

// ─── Template: Pedido Cancelado ───────────────────────────────────────────────

function buildOrderCancelledEmail(order: any, items: any[], firstName: string): { subject: string; html: string } {
  const subject = `❌ Pedido #${order.id} foi cancelado`
  const html = wrapEmail(`
    <div style="text-align:center;margin-bottom:28px;">
      <div style="font-size:48px;margin-bottom:12px;">❌</div>
      <h1 style="margin:0;font-size:24px;font-weight:700;color:#111;">Pedido cancelado</h1>
      <p style="margin:8px 0 0;font-size:15px;color:#555;">Seu pedido foi cancelado conforme solicitado.</p>
    </div>

    <p style="font-size:15px;color:#333;margin:0 0 20px;">Olá, <strong>${firstName}</strong>! 👋</p>
    <p style="font-size:15px;color:#555;margin:0 0 20px;line-height:1.6;">
      Informamos que o seu pedido <strong>#${order.id}</strong> foi <strong>cancelado</strong>. Caso o pagamento já tenha sido processado, o estorno será realizado conforme a política da forma de pagamento utilizada.
    </p>

    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:14px 16px;margin:0 0 20px;font-size:14px;color:#991b1b;">
      ⚠️ <strong>Pedido #${order.id}</strong> cancelado em ${formatDate(new Date().toISOString())}
    </div>

    ${buildItemsTable(items)}
    ${buildTotalsBlock(order)}

    <p style="font-size:15px;color:#555;margin:20px 0 0;line-height:1.6;">
      Se o cancelamento foi um engano ou se tiver qualquer dúvida, entre em contato com nossa equipe — ficaremos felizes em ajudar! 💬
    </p>
  `, order.id)

  return { subject, html }
}

// ─── Handler principal ────────────────────────────────────────────────────────

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
    const { event_type, order_id } = body

    console.log(`[${FN}] Recebido`, { event_type, order_id })

    if (!event_type || !order_id) {
      return new Response(
        JSON.stringify({ error: 'event_type e order_id são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const validEvents = ['order_paid', 'order_packed', 'order_cancelled']
    if (!validEvents.includes(event_type)) {
      console.log(`[${FN}] Evento ignorado: ${event_type}`)
      return new Response(
        JSON.stringify({ message: 'Evento não requer e-mail', event_type }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── 1. Buscar pedido ──────────────────────────────────────────────────────
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .single()

    if (orderError || !order) {
      console.error(`[${FN}] Pedido não encontrado`, { order_id, error: orderError?.message })
      return new Response(
        JSON.stringify({ error: 'Pedido não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── 2. Buscar itens do pedido ─────────────────────────────────────────────
    const { data: items } = await supabaseAdmin
      .from('order_items')
      .select('name_at_purchase, quantity, price_at_purchase')
      .eq('order_id', order_id)

    // ── 3. Resolver e-mail e nome do cliente ──────────────────────────────────
    let customerEmail: string | null = null
    let firstName = 'Cliente'

    if (order.user_id) {
      // Usuário logado: busca no auth
      try {
        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(order.user_id)
        customerEmail = userData?.user?.email ?? null
      } catch (e) {
        console.warn(`[${FN}] Falha ao buscar e-mail do auth`, { error: e?.message })
      }

      // Busca nome no perfil
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('first_name')
        .eq('id', order.user_id)
        .maybeSingle()

      if (profile?.first_name) firstName = profile.first_name
    }

    // Guest: usa guest_email se não tiver user_id ou se auth não retornou e-mail
    if (!customerEmail && order.guest_email) {
      customerEmail = order.guest_email
      // Tenta extrair nome do endereço de entrega para guests
      const addr = order.shipping_address
      if (addr?.first_name) firstName = addr.first_name
    }

    if (!customerEmail) {
      console.warn(`[${FN}] Nenhum e-mail encontrado para o pedido ${order_id}. E-mail não enviado.`)
      return new Response(
        JSON.stringify({ message: 'Nenhum e-mail disponível para este pedido', order_id }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── 4. Montar e-mail conforme o evento ────────────────────────────────────
    let emailContent: { subject: string; html: string }

    if (event_type === 'order_paid') {
      emailContent = buildOrderPaidEmail(order, items ?? [], firstName)
    } else if (event_type === 'order_packed') {
      emailContent = buildOrderPackedEmail(order, items ?? [], firstName)
    } else {
      emailContent = buildOrderCancelledEmail(order, items ?? [], firstName)
    }

    // ── 5. Enviar via Resend ──────────────────────────────────────────────────
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'noreply@example.com'

    if (!resendApiKey) {
      console.error(`[${FN}] RESEND_API_KEY não configurada`)
      return new Response(
        JSON.stringify({ error: 'RESEND_API_KEY não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[${FN}] Enviando e-mail`, { event_type, order_id, to: customerEmail, subject: emailContent.subject })

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [customerEmail],
        subject: emailContent.subject,
        html: emailContent.html,
      }),
    })

    const resendData = await resendResponse.json()

    if (!resendResponse.ok) {
      console.error(`[${FN}] Erro ao enviar via Resend`, { status: resendResponse.status, data: resendData })

      await supabaseAdmin.from('integration_logs').insert({
        event_type: `email_${event_type}`,
        status: 'error',
        response_code: resendResponse.status,
        details: `Pedido #${order_id} | Para: ${customerEmail} | Erro: ${JSON.stringify(resendData)}`,
      })

      return new Response(
        JSON.stringify({ error: 'Falha ao enviar e-mail', details: resendData }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[${FN}] E-mail enviado com sucesso`, { event_type, order_id, resend_id: resendData?.id })

    // ── 6. Registrar sucesso em integration_logs ──────────────────────────────
    await supabaseAdmin.from('integration_logs').insert({
      event_type: `email_${event_type}`,
      status: 'success',
      response_code: 200,
      details: `Pedido #${order_id} | Para: ${customerEmail} | Assunto: ${emailContent.subject} | Resend ID: ${resendData?.id}`,
    })

    return new Response(
      JSON.stringify({ success: true, resend_id: resendData?.id, to: customerEmail }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error(`[${FN}] Erro inesperado`, { error: error?.message || String(error) })
    return new Response(
      JSON.stringify({ error: error?.message || 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
