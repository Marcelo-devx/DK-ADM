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
    // 1. Auth Validation
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { orderId } = await req.json();
    if (!orderId) throw new Error("Order ID is required");

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // 2. Fetch Order — SEM join com profiles (profiles não tem coluna email)
    const { data: order, error: orderError } = await supabaseAdmin
        .from('orders')
        .select('id, user_id, total_price')
        .eq('id', orderId)
        .single();

    if (orderError || !order) throw new Error("Pedido não encontrado.");

    console.log('[create-mercadopago-preference] Order fetched', { orderId, total_price: order.total_price });

    // 3. Security Check: Ownership or Admin
    if (order.user_id !== user.id) {
        const { data: profileCheck } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
        
        if (profileCheck?.role !== 'adm') {
            return new Response(JSON.stringify({ error: 'Forbidden: Acesso negado a este pedido.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
    }

    // 4. Fetch Profile separately (first_name, last_name, phone, cpf_cnpj)
    let profileData: any = null;
    if (order.user_id) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('first_name, last_name, phone, cpf_cnpj')
        .eq('id', order.user_id)
        .maybeSingle();
      profileData = profile;
    }

    // 5. Fetch Email from auth.users — profiles NÃO tem coluna email
    let userEmail = "cliente@email.com";
    if (order.user_id) {
      try {
        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(order.user_id);
        if (userData?.user?.email) userEmail = userData.user.email;
      } catch (e) {
        console.warn('[create-mercadopago-preference] Could not fetch user email from auth', e?.message || e);
      }
    }

    console.log('[create-mercadopago-preference] Payer resolved', {
      email: userEmail,
      name: profileData?.first_name,
      hasPhone: !!profileData?.phone,
      hasCpf: !!profileData?.cpf_cnpj
    });

    // 6. Fetch Settings and Determine Mode (Test vs Production)
    const { data: settingsData } = await supabaseAdmin
        .from('app_settings')
        .select('key, value')
        .in('key', ['mercadopago_access_token', 'mercadopago_test_access_token', 'payment_mode', 'site_url']);
    
    const settings: Record<string, string> = {};
    settingsData?.forEach((s: any) => { settings[s.key] = s.value; });

    const mode = settings['payment_mode'] === 'production' ? 'production' : 'test';
    const token = mode === 'production'
        ? settings['mercadopago_access_token']
        : settings['mercadopago_test_access_token'];

    const siteUrl = settings['site_url'] || 'http://localhost:8080';

    if (!token) throw new Error(`Token do Mercado Pago (${mode}) não configurado.`);

    // total_price já é o valor final (inclui frete, doação, desconto de cupom)
    const totalAmount = Number(order.total_price);

    console.log('[create-mercadopago-preference] Total amount for preference', { totalAmount, mode });

    // Build payer object — phone e cpf só se válidos (evita rejeição do MP)
    const payer: any = {
      name: profileData?.first_name || "Cliente",
      surname: profileData?.last_name || "",
      email: userEmail,
      date_created: new Date().toISOString(),
    };

    if (profileData?.phone) {
      const cleanPhone = profileData.phone.replace(/\D/g, "");
      if (cleanPhone.length >= 8) {
        payer.phone = {
          area_code: cleanPhone.length >= 10 ? cleanPhone.slice(0, 2) : "55",
          number: cleanPhone.length >= 10 ? cleanPhone.slice(2) : cleanPhone,
        };
      }
    }

    if (profileData?.cpf_cnpj) {
      const cleanCpf = profileData.cpf_cnpj.replace(/\D/g, "");
      if (cleanCpf.length >= 11) {
        payer.identification = { type: "CPF", number: cleanCpf };
      }
    }

    // 8. Create Preference
    const preferenceBody: any = {
        items: [
            {
                id: String(orderId),
                title: `Pedido #${orderId} - Tabacaria`,
                description: `Compra realizada na loja. Pedido #${orderId}`,
                quantity: 1,
                currency_id: 'BRL',
                unit_price: Number(totalAmount.toFixed(2))
            }
        ],
        payer,
        payment_methods: {
            excluded_payment_types: [
                { id: "ticket" },
                { id: "bank_transfer" },
                { id: "digital_currency" }
            ],
            installments: 12
        },
        back_urls: {
            success: `${siteUrl}/meus-pedidos?status=success`,
            failure: `${siteUrl}/meus-pedidos?status=failure`,
            pending: `${siteUrl}/meus-pedidos?status=pending`
        },
        auto_return: "approved",
        external_reference: String(orderId),
        statement_descriptor: "TABACARIA"
    };

    // Ensure notification_url is a reachable public URL.
    // Prefer Deno.env SUPABASE_URL, but fallback to the known project URL (public Supabase domain).
    const envSupabaseUrl = Deno.env.get('SUPABASE_URL');
    const fallbackSupabaseHost = 'https://jrlozhhvwqfmjtkmvukf.supabase.co';
    const resolvedSupabaseUrl = envSupabaseUrl && envSupabaseUrl.trim() !== '' ? envSupabaseUrl.replace(/\/$/, '') : fallbackSupabaseHost;
    const notificationUrl = `${resolvedSupabaseUrl}/functions/v1/mp-webhook`;

    // attach notification_url and log it
    preferenceBody.notification_url = notificationUrl;
    console.log('[create-mercadopago-preference] Using notification_url for MP webhook', { notificationUrl });

    console.log('[create-mercadopago-preference] Sending preference to MP', { 
      orderId, 
      totalAmount, 
      notification_url: preferenceBody.notification_url 
    });

    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(preferenceBody)
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
        console.error('[create-mercadopago-preference] Erro MP:', JSON.stringify(mpData));
        throw new Error(mpData.message || mpData.error || "Erro ao gerar link de pagamento.");
    }

    console.log('[create-mercadopago-preference] Preference created', { 
      preferenceId: mpData.id, 
      mode
    });

    return new Response(
      JSON.stringify({ 
        init_point: mode === 'production' ? mpData.init_point : mpData.sandbox_init_point,
        mode: mode,
        id: mpData.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('[create-mercadopago-preference] Error:', error?.message || String(error));
    return new Response(JSON.stringify({ error: error?.message || String(error) }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
})