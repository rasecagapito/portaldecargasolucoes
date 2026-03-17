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

    // Validar chamador
    const { data: { user: caller }, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { client_id, file_path } = await req.json();

    if (!client_id || !file_path) {
      return new Response(JSON.stringify({ error: "client_id e file_path são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get profile for tenant_id
    const { data: profile } = await adminClient
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", caller.id)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: "Perfil não encontrado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Buscar credenciais SAP (cliente com fallback tenant)
    const { data: sapConfig, error: sapError } = await adminClient
      .rpc('get_decrypted_client_sap_config', {
        p_client_id: client_id,
        p_tenant_id: profile.tenant_id,
        p_master_key: Deno.env.get("SAP_MASTER_KEY") || ""
      })
      .maybeSingle();

    if (sapError || !sapConfig) {
      return new Response(
        JSON.stringify({ error: "Configuração SAP não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Gerar signed URL do arquivo (válida por 1 hora)
    const { data: signedUrlData, error: signedUrlError } = await adminClient
      .storage.from('sped-files').createSignedUrl(file_path, 3600);

    if (signedUrlError || !signedUrlData) {
      return new Response(
        JSON.stringify({ error: "Erro ao gerar URL do arquivo" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Criar registro em sped_uploads
    const { data: record, error: insertError } = await adminClient
      .from("sped_uploads")
      .insert({
        tenant_id: profile.tenant_id,
        client_id: client_id,
        file_path: file_path,
        user_id: caller.id,
        status: "processing"
      })
      .select("id")
      .single();

    if (insertError || !record) {
      throw new Error(`Erro ao criar registro: ${insertError.message}`);
    }

    // 2. Disparar Webhook n8n
    // O workflow será criado manualmente pelo usuário seguindo o JSON gerado
    const n8nWebhookUrl = Deno.env.get("N8N_SPED_WEBHOOK_URL") 
      || "https://tododiasoftware.app.n8n.cloud/webhook/dispatch-carga-sped";

    try {
      const resp = await fetch(n8nWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: record.id,
          tenant_id: profile.tenant_id,
          client_id: client_id,
          file_path: file_path,
          signed_url: signedUrlData.signedUrl,
          callback_url: `${supabaseUrl}/functions/v1/carga-callback`,
          sap_url: sapConfig.sap_url,
          sap_company_db: sapConfig.sap_company_db,
          sap_user: sapConfig.sap_user,
          sap_password: sapConfig.decrypted_password
        })
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`n8n error (${resp.status}): ${text}`);
      }
    } catch (err) {
      console.error("n8n dispatch failed:", err);
      // Update status to error if dispatch fails
      await adminClient
        .from("sped_uploads")
        .update({ status: "error" })
        .eq("id", record.id);
      
      return new Response(JSON.stringify({ error: "Falha ao disparar automação n8n", details: err.message }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, id: record.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
