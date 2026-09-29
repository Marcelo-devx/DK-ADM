import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ALLOWED_ROLES = ['adm', 'gerente', 'gerente_geral']

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) {
      return new Response('Invalid token', { status: 401, headers: corsHeaders })
    }

    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!callerProfile || !ALLOWED_ROLES.includes(callerProfile.role)) {
      console.error('[admin-set-vip] Acesso negado para usuário', user.id)
      return new Response('Forbidden', { status: 403, headers: corsHeaders })
    }

    const { userId, isVip } = await req.json()

    if (!userId || typeof isVip !== 'boolean') {
      return new Response('Invalid request body', { status: 400, headers: corsHeaders })
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ is_vip: isVip, updated_at: new Date().toISOString() })
      .eq('id', userId)

    if (updateError) {
      console.error('[admin-set-vip] Erro ao atualizar perfil:', updateError)
      return new Response(updateError.message, { status: 500, headers: corsHeaders })
    }

    console.log(`[admin-set-vip] Usuário ${userId} foi marcado como ${isVip ? 'VIP' : 'não-VIP'} por ${user.id}`)

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[admin-set-vip] Erro:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
