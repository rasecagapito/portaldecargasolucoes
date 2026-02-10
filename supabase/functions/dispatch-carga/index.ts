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

    // Validate caller
    const { data: { user: caller }, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check role (admin or operator)
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .single();

    if (!roleData || !["admin", "operator"].includes(roleData.role)) {
      return new Response(
        JSON.stringify({ error: "Permissão insuficiente. Requer admin ou operator." }),
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
    const { carga_id, params } = await req.json();

    if (!carga_id) {
      return new Response(JSON.stringify({ error: "carga_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch carga and validate tenant
    const { data: carga, error: cargaError } = await adminClient
      .from("cargas")
      .select("id, webhook_url, active, tenant_id, name")
      .eq("id", carga_id)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (cargaError || !carga) {
      return new Response(JSON.stringify({ error: "Carga não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!carga.active) {
      return new Response(JSON.stringify({ error: "Carga está desativada" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create execution record with status pending
    const { data: execution, error: insertError } = await adminClient
      .from("carga_executions")
      .insert({
        tenant_id: tenantId,
        carga_id: carga.id,
        status: "pending",
        user_id: caller.id,
        params: params || {},
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertError || !execution) {
      console.error("Insert error:", insertError?.message);
      return new Response(JSON.stringify({ error: "Erro ao criar execução" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build callback URL
    const callbackUrl = `${supabaseUrl}/functions/v1/carga-callback`;

    // Send POST to n8n webhook
    try {
      const webhookResponse = await fetch(carga.webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          execution_id: execution.id,
          tenant_id: tenantId,
          carga_id: carga.id,
          carga_name: carga.name,
          params: params || {},
          callback_url: callbackUrl,
        }),
      });

      if (!webhookResponse.ok) {
        const errorText = await webhookResponse.text();
        console.error("Webhook error:", errorText);
        // Update execution to error
        await adminClient
          .from("carga_executions")
          .update({ status: "error", error_message: `Webhook retornou ${webhookResponse.status}: ${errorText}`, finished_at: new Date().toISOString() })
          .eq("id", execution.id);

        return new Response(
          JSON.stringify({ error: "Erro ao enviar para n8n", execution_id: execution.id }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await webhookResponse.text(); // consume body
    } catch (fetchErr) {
      console.error("Fetch error:", (fetchErr as Error).message);
      await adminClient
        .from("carga_executions")
        .update({ status: "error", error_message: `Erro de conexão: ${(fetchErr as Error).message}`, finished_at: new Date().toISOString() })
        .eq("id", execution.id);

      return new Response(
        JSON.stringify({ error: "Falha ao conectar com n8n", execution_id: execution.id }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update status to running
    await adminClient
      .from("carga_executions")
      .update({ status: "running" })
      .eq("id", execution.id);

    return new Response(
      JSON.stringify({ success: true, execution_id: execution.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", (err as Error).message);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
