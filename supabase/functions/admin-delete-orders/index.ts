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
    // 1. Create Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // 2. Check if the caller is an admin (using the regular client + profile check)
    const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error('Authentication failed');

    const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
    if (profileError || profile.role !== 'adm') {
        return new Response(JSON.stringify({ error: 'Not authorized' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 3. Get payload
    const { targetUserId } = await req.json();
    if (!targetUserId) {
      throw new Error("targetUserId is required.");
    }

    // 4. Delete all orders associated with the target user
    const { error: deleteError } = await supabaseAdmin
        .from('orders')
        .delete()
        .eq('user_id', targetUserId);

    if (deleteError) throw deleteError;

    // 5. Also delete any associated first_orders records (optional, but good cleanup)
    const { error: deleteFirstOrdersError } = await supabaseAdmin
        .from('primeiros_pedidos')
        .delete()
        .eq('user_id', targetUserId);
    
    if (deleteFirstOrdersError) console.error('Warning: Failed to delete first_orders records:', deleteFirstOrdersError);


    return new Response(
      JSON.stringify({ message: `Todos os pedidos do usuário ${targetUserId} foram removidos. O status de compra foi redefinido para 'Primeira Compra'.` }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error in admin-delete-orders:', error);
    return new Response(
      JSON.stringify({ error: 'Falha ao remover pedidos.', details: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})