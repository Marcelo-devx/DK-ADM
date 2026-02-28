// @ts-ignore - Deno edge function types
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// @ts-ignore
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // @ts-ignore
    const supabaseAdmin = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const url = new URL(req.url);
    const method = req.method;

    // GET - List all API configs
    if (method === 'GET') {
      const { data: apis, error } = await supabaseAdmin
        .from('api_configs')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return new Response(JSON.stringify(apis), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // POST - Create new API config
    if (method === 'POST') {
      const { name, method, path, description } = await req.json();
      
      if (!name || !method || !path) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      const { data, error } = await supabaseAdmin
        .from('api_configs')
        .insert({ name, method, path, description })
        .select()
        .single();
      
      if (error) throw error;
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // PUT - Update API config
    if (method === 'PUT') {
      const { id, name, method, path, description, is_active } = await req.json();
      
      if (!id) {
        return new Response(JSON.stringify({ error: 'Missing id' }), { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      const { data, error } = await supabaseAdmin
        .from('api_configs')
        .update({ name, method, path, description, is_active })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // DELETE - Remove API config
    if (method === 'DELETE') {
      const id = url.searchParams.get('id');
      
      if (!id) {
        return new Response(JSON.stringify({ error: 'Missing id' }), { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      const { error } = await supabaseAdmin
        .from('api_configs')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
      status: 405, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error: any) {
    console.error('[api-config-manager] ERROR:', error);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});