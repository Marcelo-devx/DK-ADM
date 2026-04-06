import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Verificar autenticação
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    }

    // Criar cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Verificar token
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) {
      return new Response('Invalid token', { status: 401, headers: corsHeaders })
    }

    // Verificar se é admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'adm') {
      return new Response('Forbidden - Admin only', { status: 403, headers: corsHeaders })
    }

    // Parse request body
    const { userId, isBlocked, reason } = await req.json()

    if (!userId || typeof isBlocked !== 'boolean') {
      return new Response('Invalid request body', { status: 400, headers: corsHeaders })
    }

    // Atualizar is_blocked no perfil
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        is_blocked: isBlocked,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)

    if (updateError) {
      console.error('[admin-block-user] Erro ao atualizar perfil:', updateError)
      return new Response(updateError.message, { status: 500, headers: corsHeaders })
    }

    console.log(`[admin-block-user] Usuário ${userId} foi ${isBlocked ? 'bloqueado' : 'desbloqueado'}. Motivo: ${reason || 'N/A'}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Usuário ${isBlocked ? 'bloqueado' : 'desbloqueado'} com sucesso` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[admin-block-user] Erro:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
