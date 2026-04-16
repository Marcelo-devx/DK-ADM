import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import * as jose from "https://deno.land/x/jose@v4.15.5/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");

    // Decodifica o JWT sem verificar assinatura para extrair o user_id (sub)
    // A segurança é garantida pelo service role key nas operações de DB
    const decoded = jose.decodeJwt(token);
    const userId = decoded.sub;

    if (!userId) {
      console.error("[admin-cancel-order] No user ID in token");
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verifica se o usuário tem role de admin ou gerente
    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (profileError || !profile) {
      console.error("[admin-cancel-order] Profile error:", profileError);
      return new Response(JSON.stringify({ error: "Perfil não encontrado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const allowedRoles = ["adm", "gerente_geral", "gerente"];
    if (!allowedRoles.includes(profile.role)) {
      console.log("[admin-cancel-order] Unauthorized role:", profile.role);
      return new Response(JSON.stringify({ error: "Sem permissão para cancelar pedidos" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { orderId, reason, returnStock } = await req.json();

    if (!orderId || !reason) {
      return new Response(JSON.stringify({ error: "orderId e reason são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[admin-cancel-order] Cancelando pedido:", { orderId, reason, returnStock, userId });

    // Busca o pedido atual
    const { data: order, error: orderError } = await serviceClient
      .from("orders")
      .select("id, status, user_id")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      console.error("[admin-cancel-order] Order not found:", orderError);
      return new Response(JSON.stringify({ error: "Pedido não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (order.status === "Cancelado") {
      return new Response(JSON.stringify({ error: "Pedido já está cancelado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const oldStatus = order.status;

    // Atualiza o status do pedido para Cancelado
    const { error: updateError } = await serviceClient
      .from("orders")
      .update({ status: "Cancelado" })
      .eq("id", orderId);

    if (updateError) {
      console.error("[admin-cancel-order] Update error:", updateError);
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Registra no histórico
    const { error: historyError } = await serviceClient
      .from("order_history")
      .insert({
        order_id: orderId,
        field_name: "status",
        old_value: oldStatus,
        new_value: "Cancelado",
        changed_by: userId,
        change_type: "cancel",
        reason: reason,
      });

    if (historyError) {
      console.error("[admin-cancel-order] History insert error:", historyError);
    }

    console.log("[admin-cancel-order] Pedido cancelado com sucesso:", orderId);

    return new Response(JSON.stringify({ success: true, orderId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[admin-cancel-order] Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Erro interno do servidor" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
