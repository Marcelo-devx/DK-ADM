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

    // Criar cliente Supabase com service role
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
    const { userId, deleteOrders, reason } = await req.json()

    if (!userId || typeof deleteOrders !== 'boolean') {
      return new Response('Invalid request body', { status: 400, headers: corsHeaders })
    }

    // Verificar se não está tentando excluir a si mesmo
    if (userId === user.id) {
      return new Response('Cannot delete yourself', { status: 400, headers: corsHeaders })
    }

    console.log(`[admin-delete-user] Excluindo usuário ${userId}. Excluir pedidos: ${deleteOrders}. Motivo: ${reason || 'N/A'}`)

    // Se deleteOrders for true, excluir pedidos primeiro
    if (deleteOrders) {
      const { error: ordersError } = await supabase
        .from('orders')
        .delete()
        .eq('user_id', userId)

      if (ordersError) {
        console.error('[admin-delete-user] Erro ao excluir pedidos:', ordersError)
        return new Response('Error deleting orders', { status: 500, headers: corsHeaders })
      }

      console.log(`[admin-delete-user] Pedidos do usuário ${userId} excluídos`)
    }

    // Excluir profile
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId)

    if (profileError) {
      console.error('[admin-delete-user] Erro ao excluir profile:', profileError)
      return new Response('Error deleting profile', { status: 500, headers: corsHeaders })
    }

    // Excluir usuário do auth.users (precisa usar admin API)
    const { error: authError } = await supabase.auth.admin.deleteUser(userId)
    if (authError) {
      console.error('[admin-delete-user] Erro ao excluir auth user:', authError)
      // Continuar mesmo se falhar excluir auth.user (profile já foi excluído)
    }

    console.log(`[admin-delete-user] Usuário ${userId} excluído com sucesso`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: deleteOrders 
          ? 'Usuário e todos os pedidos excluídos com sucesso' 
          : 'Usuário excluído com sucesso (pedidos mantidos)' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[admin-delete-user] Erro:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
