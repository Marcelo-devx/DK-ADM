// @ts-nocheck
import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // 1. Validação de Admin
    const authHeader = req.headers.get('Authorization')!;
    const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '', 
        Deno.env.get('SUPABASE_ANON_KEY') ?? '', 
        { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await supabaseClient.auth.getUser();
    
    const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', user?.id).single();
    if (profile?.role !== 'adm') {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: corsHeaders });
    }

    const { userIds, messageTemplate } = await req.json();

    if (!userIds || userIds.length === 0) {
        throw new Error("Nenhum cliente selecionado.");
    }

    // 2. Buscar Webhooks Ativos
    const { data: webhooks } = await supabaseAdmin
        .from('webhook_configs')
        .select('target_url')
        .eq('is_active', true)
        .eq('trigger_event', 'retention_campaign');

    // 3. Processar Clientes e Mensagens
    let dispatchedCount = 0;
    if (webhooks && webhooks.length > 0) {
        const { data: profiles } = await supabaseAdmin
            .from('profiles')
            .select('id, first_name, last_name, phone')
            .in('id', userIds);
        
        // Busca Emails
        const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
        const emailMap = new Map(users.map(u => [u.id, u.email]));

        const notifications = profiles?.map(p => {
            const firstName = p.first_name || 'Cliente';
            // Substitui a variável {{name}} pelo primeiro nome
            const finalMessage = messageTemplate 
                ? messageTemplate.replace(/{{name}}/g, firstName)
                : `Olá ${firstName}, sentimos sua falta!`;

            return {
                client_id: p.id,
                name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Cliente',
                phone: p.phone,
                email: emailMap.get(p.id),
                message_content: finalMessage
            };
        });

        if (notifications) {
            // Dispara para cada URL configurada
            for (const hook of webhooks) {
                try {
                    await fetch(hook.target_url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            event: 'retention_campaign', 
                            campaign_size: notifications.length,
                            recipients: notifications 
                        })
                    });
                    dispatchedCount++;
                } catch (e) {
                    console.error(`Falha ao disparar webhook ${hook.target_url}`, e);
                }
            }
        }
    }

    return new Response(
      JSON.stringify({ 
          success: true, 
          message: `Processado para ${userIds.length} clientes.`,
          webhooks_fired: dispatchedCount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders });
  }
})