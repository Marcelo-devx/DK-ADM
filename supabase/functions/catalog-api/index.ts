// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Validação de Admin (Serverside)
    const authHeader = req.headers.get('Authorization')!;
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await supabaseClient.auth.getUser();
    
    const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', user?.id).single();
    if (profile?.role !== 'adm') {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: corsHeaders });
    }

    const { action, id, data } = await req.json();

    switch (action) {
      case "list_products":
        const { data: products } = await supabaseAdmin.from("products").select("*").order("created_at", { ascending: false });
        return new Response(JSON.stringify(products), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      case "create_product":
        // Regra de Negócio: Garantir SKU único ou gerar se nulo
        const { error: insertError } = await supabaseAdmin.from("products").insert([data]);
        if (insertError) throw insertError;
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });

      case "update_product":
        const { error: updateError } = await supabaseAdmin.from("products").update(data).eq("id", id);
        if (updateError) throw updateError;
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });

      case "delete_product":
        // Regra de Negócio: Verificar se há estoque antes de deletar? Ou se há pedidos vinculados?
        const { error: deleteError } = await supabaseAdmin.from("products").delete().eq("id", id);
        if (deleteError) throw deleteError;
        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });

      default:
        throw new Error("Invalid action");
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders });
  }
})