import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user: caller }, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { target_user_id, new_password } = await req.json();

    if (!new_password || typeof new_password !== "string" || new_password.length < 8) {
      return new Response(
        JSON.stringify({ error: "Senha deve ter no mínimo 8 caracteres" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get caller profile & role
    const [{ data: callerProfile }, { data: callerRole }] = await Promise.all([
      adminClient.from("profiles").select("tenant_id").eq("user_id", caller.id).single(),
      adminClient.from("user_roles").select("role").eq("user_id", caller.id).maybeSingle(),
    ]);

    if (!callerProfile) {
      return new Response(JSON.stringify({ error: "Perfil não encontrado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tenantId = callerProfile.tenant_id;
    const isAdmin = callerRole?.role === "admin";
    const isSelf = !target_user_id || target_user_id === caller.id;

    // Non-admin can only change own password
    if (!isSelf && !isAdmin) {
      return new Response(
        JSON.stringify({ error: "Permissão insuficiente" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userIdToUpdate = isSelf ? caller.id : target_user_id;

    // If admin changing another user, verify same tenant
    if (!isSelf) {
      const { data: targetProfile } = await adminClient
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", userIdToUpdate)
        .single();

      if (!targetProfile || targetProfile.tenant_id !== tenantId) {
        return new Response(
          JSON.stringify({ error: "Usuário não encontrado neste tenant" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Update password
    const { error: updateError } = await adminClient.auth.admin.updateUserById(userIdToUpdate, {
      password: new_password,
    });

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Audit log
    const action = isSelf ? "password_changed_self" : "password_changed_by_admin";
    await adminClient.from("audit_logs").insert({
      tenant_id: tenantId,
      actor_id: caller.id,
      action,
      target_type: "user",
      target_id: userIdToUpdate,
      details: isSelf ? {} : { changed_by: caller.id },
    });

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
