import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  // Verify caller is an authenticated admin
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const callerToken = authHeader.replace("Bearer ", "");
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${callerToken}` } },
  });

  const { data: { user: caller }, error: callerErr } = await callerClient.auth.getUser();
  if (callerErr || !caller) {
    console.error("[admin-delete-user] Failed to get caller user", callerErr);
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  // Check caller is admin
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: profile, error: profileErr } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", caller.id)
    .single();

  if (profileErr || profile?.role !== "adm") {
    console.error("[admin-delete-user] Caller is not admin", { role: profile?.role });
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  const { targetUserId } = await req.json();
  if (!targetUserId) {
    return new Response("targetUserId is required", { status: 400, headers: corsHeaders });
  }

  console.log("[admin-delete-user] Deleting user", { targetUserId, callerEmail: caller.email });

  const { error: deleteErr } = await adminClient.auth.admin.deleteUser(targetUserId);
  if (deleteErr) {
    console.error("[admin-delete-user] Error deleting user", deleteErr);
    return new Response(JSON.stringify({ error: deleteErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log("[admin-delete-user] User deleted successfully", { targetUserId });
  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
