import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function logAudit(
  adminClient: ReturnType<typeof createClient>,
  tenantId: string,
  actorId: string,
  action: string,
  targetType: string,
  targetId: string,
  details: Record<string, unknown> = {}
) {
  await adminClient.from("audit_logs").insert({
    tenant_id: tenantId,
    actor_id: actorId,
    action,
    target_type: targetType,
    target_id: targetId,
    details,
  });
}

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
      console.error("Auth error:", authError?.message);
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: "Apenas admins podem gerenciar usuários" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get caller's tenant
    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", caller.id)
      .single();

    if (!callerProfile) {
      return new Response(JSON.stringify({ error: "Perfil não encontrado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tenantId = callerProfile.tenant_id;
    const { action, ...payload } = await req.json();

    // CREATE USER
    if (action === "create") {
      const { email, password, full_name, role } = payload;

      if (!email || !password || !full_name || !role) {
        return new Response(
          JSON.stringify({ error: "Campos obrigatórios: email, password, full_name, role" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const validRoles = ["admin", "operator", "viewer"];
      if (!validRoles.includes(role)) {
        return new Response(
          JSON.stringify({ error: "Role inválida" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: newUser, error: createError } =
        await adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { tenant_id: tenantId, full_name, role },
        });

      if (createError) {
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await logAudit(adminClient, tenantId, caller.id, "user.created", "user", newUser.user?.id ?? "", {
        email, full_name, role,
      });

      return new Response(
        JSON.stringify({ success: true, user_id: newUser.user?.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // UPDATE USER
    if (action === "update") {
      const { user_id, full_name, role, active } = payload;

      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Block self-modification
      if (user_id === caller.id) {
        return new Response(
          JSON.stringify({ error: "Operação não permitida. Você não pode alterar seu próprio status ou perfil." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Verify user belongs to same tenant
      const { data: targetProfile } = await adminClient
        .from("profiles")
        .select("tenant_id, full_name, active")
        .eq("user_id", user_id)
        .single();

      if (!targetProfile || targetProfile.tenant_id !== tenantId) {
        return new Response(
          JSON.stringify({ error: "Usuário não encontrado neste tenant" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update profile
      const profileUpdates: Record<string, unknown> = {};
      if (full_name !== undefined) profileUpdates.full_name = full_name;
      if (active !== undefined) profileUpdates.active = active;

      if (Object.keys(profileUpdates).length > 0) {
        await adminClient
          .from("profiles")
          .update(profileUpdates)
          .eq("user_id", user_id);
      }

      // Update role
      if (role) {
        const validRoles = ["admin", "operator", "viewer"];
        if (!validRoles.includes(role)) {
          return new Response(
            JSON.stringify({ error: "Role inválida" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Get old role for audit
        const { data: oldRole } = await adminClient
          .from("user_roles")
          .select("role")
          .eq("user_id", user_id)
          .eq("tenant_id", tenantId)
          .single();

        await adminClient
          .from("user_roles")
          .update({ role })
          .eq("user_id", user_id)
          .eq("tenant_id", tenantId);

        if (oldRole?.role !== role) {
          await logAudit(adminClient, tenantId, caller.id, "role.updated", "user", user_id, {
            old_role: oldRole?.role, new_role: role,
          });
        }
      }

      if (active !== undefined) {
        await logAudit(adminClient, tenantId, caller.id, active ? "user.activated" : "user.deactivated", "user", user_id, {
          full_name: targetProfile.full_name,
        });
      }

      if (full_name !== undefined && full_name !== targetProfile.full_name) {
        await logAudit(adminClient, tenantId, caller.id, "user.updated", "user", user_id, {
          old_name: targetProfile.full_name, new_name: full_name,
        });
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Ação inválida. Use: create, update" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
