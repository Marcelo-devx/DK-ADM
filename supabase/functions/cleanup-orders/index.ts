import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PRESERVE_ORDER_ID = 492;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[cleanup-orders] Iniciando processo de limpeza de pedidos");

    // Autenticação: verifica se é admin via JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("[cleanup-orders] Sem header de autorização");
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cria cliente com anon key para verificar o usuário
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      console.error("[cleanup-orders] Usuário não autenticado:", authError?.message);
      return new Response(JSON.stringify({ error: "Usuário não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verifica se é admin
    const { data: profile, error: profileError } = await supabaseAuth
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || profile?.role !== "adm") {
      console.error("[cleanup-orders] Usuário não é admin:", user.id);
      return new Response(JSON.stringify({ error: "Acesso negado. Apenas administradores." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[cleanup-orders] Admin verificado:", user.id);

    // Cria cliente com service_role para bypassar RLS
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ─── PASSO 0: Verificar que o pedido 492 existe ───────────────────────────
    const { data: orderCheck, error: orderCheckError } = await supabase
      .from("orders")
      .select("id, status, total_price, created_at")
      .eq("id", PRESERVE_ORDER_ID)
      .single();

    if (orderCheckError || !orderCheck) {
      console.error("[cleanup-orders] Pedido #492 não encontrado!", orderCheckError?.message);
      return new Response(
        JSON.stringify({ error: `Pedido #${PRESERVE_ORDER_ID} não encontrado. Operação cancelada por segurança.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[cleanup-orders] Pedido #492 confirmado:", orderCheck);

    // ─── PASSO 1: Contar o que será deletado (para o relatório) ──────────────
    const { count: totalOrders } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .neq("id", PRESERVE_ORDER_ID);

    const { count: totalOrderItems } = await supabase
      .from("order_items")
      .select("*", { count: "exact", head: true })
      .neq("order_id", PRESERVE_ORDER_ID);

    const { count: totalOrderHistory } = await supabase
      .from("order_history")
      .select("*", { count: "exact", head: true })
      .neq("order_id", PRESERVE_ORDER_ID);

    const { count: totalPrimeirosPedidos } = await supabase
      .from("primeiros_pedidos")
      .select("*", { count: "exact", head: true })
      .neq("order_id", PRESERVE_ORDER_ID);

    const { count: totalLoyaltyHistory } = await supabase
      .from("loyalty_history")
      .select("*", { count: "exact", head: true })
      .not("related_order_id", "is", null)
      .neq("related_order_id", PRESERVE_ORDER_ID);

    const { count: totalUserCoupons } = await supabase
      .from("user_coupons")
      .select("*", { count: "exact", head: true })
      .not("order_id", "is", null)
      .neq("order_id", PRESERVE_ORDER_ID);

    console.log("[cleanup-orders] Contagem antes da limpeza:", {
      orders: totalOrders,
      order_items: totalOrderItems,
      order_history: totalOrderHistory,
      primeiros_pedidos: totalPrimeirosPedidos,
      loyalty_history: totalLoyaltyHistory,
      user_coupons: totalUserCoupons,
    });

    // ─── PASSO 2: Deletar order_history (filhos) ─────────────────────────────
    const { error: e1 } = await supabase
      .from("order_history")
      .delete()
      .neq("order_id", PRESERVE_ORDER_ID);

    if (e1) {
      console.error("[cleanup-orders] Erro ao deletar order_history:", e1.message);
      throw new Error(`Erro ao deletar order_history: ${e1.message}`);
    }
    console.log("[cleanup-orders] ✅ order_history limpo");

    // ─── PASSO 3: Deletar user_coupons vinculados a pedidos (exceto 492) ─────
    const { error: e2 } = await supabase
      .from("user_coupons")
      .delete()
      .not("order_id", "is", null)
      .neq("order_id", PRESERVE_ORDER_ID);

    if (e2) {
      console.error("[cleanup-orders] Erro ao deletar user_coupons:", e2.message);
      throw new Error(`Erro ao deletar user_coupons: ${e2.message}`);
    }
    console.log("[cleanup-orders] ✅ user_coupons vinculados limpos");

    // ─── PASSO 4: Deletar loyalty_history vinculado a pedidos (exceto 492) ───
    const { error: e3 } = await supabase
      .from("loyalty_history")
      .delete()
      .not("related_order_id", "is", null)
      .neq("related_order_id", PRESERVE_ORDER_ID);

    if (e3) {
      console.error("[cleanup-orders] Erro ao deletar loyalty_history:", e3.message);
      throw new Error(`Erro ao deletar loyalty_history: ${e3.message}`);
    }
    console.log("[cleanup-orders] ✅ loyalty_history vinculado limpo");

    // ─── PASSO 5: Deletar primeiros_pedidos (exceto 492) ─────────────────────
    const { error: e4 } = await supabase
      .from("primeiros_pedidos")
      .delete()
      .neq("order_id", PRESERVE_ORDER_ID);

    if (e4) {
      console.error("[cleanup-orders] Erro ao deletar primeiros_pedidos:", e4.message);
      throw new Error(`Erro ao deletar primeiros_pedidos: ${e4.message}`);
    }
    console.log("[cleanup-orders] ✅ primeiros_pedidos limpo");

    // ─── PASSO 6: Deletar order_items (exceto os do pedido 492) ──────────────
    const { error: e5 } = await supabase
      .from("order_items")
      .delete()
      .neq("order_id", PRESERVE_ORDER_ID);

    if (e5) {
      console.error("[cleanup-orders] Erro ao deletar order_items:", e5.message);
      throw new Error(`Erro ao deletar order_items: ${e5.message}`);
    }
    console.log("[cleanup-orders] ✅ order_items limpos");

    // ─── PASSO 7: Deletar orders (exceto #492) ────────────────────────────────
    // O trigger trigger_return_stock_on_delete (BEFORE DELETE) vai devolver
    // o estoque automaticamente para cada pedido deletado.
    const { error: e6 } = await supabase
      .from("orders")
      .delete()
      .neq("id", PRESERVE_ORDER_ID);

    if (e6) {
      console.error("[cleanup-orders] Erro ao deletar orders:", e6.message);
      throw new Error(`Erro ao deletar orders: ${e6.message}`);
    }
    console.log("[cleanup-orders] ✅ orders deletados (estoque restaurado pelo trigger)");

    // ─── PASSO 8: Recalcular pontos de todos os usuários ─────────────────────
    // Zera pontos de quem não tem pedido 492, recalcula baseado no loyalty_history restante
    const { error: e7 } = await supabase.rpc("sync_loyalty_history");
    if (e7) {
      // Não é crítico, apenas loga
      console.warn("[cleanup-orders] Aviso ao sincronizar loyalty_history:", e7.message);
    } else {
      console.log("[cleanup-orders] ✅ Pontos de fidelidade sincronizados");
    }

    // ─── PASSO 9: Verificação final ───────────────────────────────────────────
    const { count: remainingOrders } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true });

    const { data: preservedOrder } = await supabase
      .from("orders")
      .select("id, status, total_price")
      .eq("id", PRESERVE_ORDER_ID)
      .single();

    const { count: preservedItems } = await supabase
      .from("order_items")
      .select("*", { count: "exact", head: true })
      .eq("order_id", PRESERVE_ORDER_ID);

    console.log("[cleanup-orders] ✅ Verificação final:", {
      pedidos_restantes: remainingOrders,
      pedido_492_preservado: !!preservedOrder,
      itens_do_492: preservedItems,
    });

    const result = {
      success: true,
      message: `Limpeza concluída com sucesso! Pedido #${PRESERVE_ORDER_ID} preservado.`,
      deleted: {
        orders: totalOrders ?? 0,
        order_items: totalOrderItems ?? 0,
        order_history: totalOrderHistory ?? 0,
        primeiros_pedidos: totalPrimeirosPedidos ?? 0,
        loyalty_history_entries: totalLoyaltyHistory ?? 0,
        user_coupons_linked: totalUserCoupons ?? 0,
      },
      preserved: {
        order_id: PRESERVE_ORDER_ID,
        status: preservedOrder?.status,
        total_price: preservedOrder?.total_price,
        items_count: preservedItems ?? 0,
      },
      remaining_orders: remainingOrders ?? 0,
      note: "Estoque restaurado automaticamente pelo trigger do banco de dados.",
    };

    console.log("[cleanup-orders] Resultado final:", result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[cleanup-orders] ERRO CRÍTICO:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
