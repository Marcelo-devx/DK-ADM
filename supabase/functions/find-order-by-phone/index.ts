// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const FN = 'find-order-by-phone'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method === 'GET') {
    const url = new URL(req.url)
    const phone = url.searchParams.get('phone')
    if (!phone) {
      return new Response(JSON.stringify({ status: 'ok' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }
  }

  try {
    let phone: string | null = null

    if (req.method === 'GET') {
      phone = new URL(req.url).searchParams.get('phone')
    } else {
      const body = await req.json()
      phone = body.phone
    }

    if (!phone) {
      return new Response(JSON.stringify({ error: 'phone é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const cleanPhone = String(phone).replace(/\D/g, '')
    console.log(`[${FN}] Buscando pedidos para telefone: ${cleanPhone}`)

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    )

    // Buscar perfil pelo telefone
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, phone')
      .ilike('phone', `%${cleanPhone}%`)
      .limit(5)

    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ orders: [], message: 'Nenhum usuário encontrado com este telefone' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userIds = profiles.map(p => p.id)

    const { data: orders } = await supabaseAdmin
      .from('orders')
      .select('id, status, total_price, created_at, payment_method, delivery_status')
      .in('user_id', userIds)
      .order('created_at', { ascending: false })
      .limit(20)

    return new Response(JSON.stringify({ orders: orders || [], profiles }), {
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
