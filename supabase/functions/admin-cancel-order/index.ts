import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight (cold start warm-up also hits this)
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Auth: verifica token se presente, mas não bloqueia (service role faz a operação)
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      try {
        const { data: { user } } = await serviceClient.auth.getUser(token);
        userId = user?.id ?? null;

        // Verifica role do usuário
        if (userId) {
          const { data: profile } = await serviceClient
            .from("profiles")
            .select("role")
            .eq("id", userId)
            .single();

          const allowedRoles = ["adm", "gerente_geral", "gerente"];
          if (profile && !allowedRoles.includes(profile.role)) {
            console.log("[admin-cancel-order] Unauthorized role:", profile.role);
            return new Response(JSON.stringify({ error: "Sem permissão para cancelar pedidos" }), {
              status: 403,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      } catch (authErr) {
        console.warn("[admin-cancel-order] Auth check failed (non-blocking):", authErr);
      }
    }

    const body = await req.json();
    const { orderId, reason, returnStock } = body;

    if (!orderId) {
      return new Response(JSON.stringify({ error: "orderId é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[admin-cancel-order] Cancelando pedido:", { orderId, reason, returnStock, userId });

    // Busca status atual
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

    // Atualiza status
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

    // Registra histórico (best-effort)
    const { error: historyError } = await serviceClient
      .from("order_history")
      .insert({
        order_id: orderId,
        field_name: "status",
        old_value: oldStatus,
        new_value: "Cancelado",
        changed_by: userId,
        change_type: "cancel",
        reason: reason || "Cancelado pelo admin",
      });

    if (historyError) {
      console.error("[admin-cancel-order] History insert error (non-blocking):", historyError);
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
