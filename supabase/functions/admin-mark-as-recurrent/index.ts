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

    // 2. Check if the caller is an admin
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

    // 4. Check if user has any orders
    const { count: orderCount, error: countError } = await supabaseAdmin
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', targetUserId);
    
    if (countError) throw countError;

    if (orderCount === 0) {
        // Insert a minimal, completed order to mark them as recurrent
        const { error: insertError } = await supabaseAdmin
            .from('orders')
            .insert({
                user_id: targetUserId,
                total_price: 0,
                shipping_cost: 0,
                status: 'Finalizada',
                shipping_address: {}, // Empty JSON object for minimal requirement
            });
        if (insertError) throw insertError;
    }

    // 5. Ensure PIX restriction is removed
    const { error: updateProfileError } = await supabaseAdmin
        .from('profiles')
        .update({ force_pix_on_next_purchase: false })
        .eq('id', targetUserId);
    
    if (updateProfileError) throw updateProfileError;


    return new Response(
      JSON.stringify({ message: `Cliente marcado como recorrente e restrição de PIX removida.` }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error in admin-mark-as-recurrent:', error);
    return new Response(
      JSON.stringify({ error: 'Falha ao marcar cliente como recorrente.', details: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})