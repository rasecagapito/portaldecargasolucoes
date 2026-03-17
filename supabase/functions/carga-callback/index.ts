import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-n8n-signature",
};

async function verifyHmac(secret: string, payload: string, signature: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const computedHex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return computedHex === signature;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const webhookSecret = Deno.env.get("N8N_WEBHOOK_SECRET");

    if (!webhookSecret) {
      console.error("N8N_WEBHOOK_SECRET not configured");
      return new Response(JSON.stringify({ error: "Server misconfigured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.text();

    // Validate HMAC signature
    const signature = req.headers.get("x-n8n-signature");
    if (!signature) {
      return new Response(JSON.stringify({ error: "Missing signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isValid = await verifyHmac(webhookSecret, body, signature);
    if (!isValid) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = JSON.parse(body);
    const { execution_id, tenant_id, status, result, error_message, entity_type = "carga" } = payload;

    if (!execution_id || !tenant_id) {
      return new Response(
        JSON.stringify({ error: "execution_id and tenant_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["success", "error"].includes(status)) {
      return new Response(
        JSON.stringify({ error: "status must be 'success' or 'error'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const targetTable = entity_type === "sped" ? "sped_uploads" : "carga_executions";

    // Update execution - validate tenant_id matches
    const { data: record, error: fetchError } = await adminClient
      .from(targetTable)
      .select("id, tenant_id")
      .eq("id", execution_id)
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    if (fetchError || !record) {
      return new Response(JSON.stringify({ error: "Record not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const updateData: any = {
      status,
      finished_at: new Date().toISOString(),
    };

    if (entity_type === "carga") {
      updateData.result = result || null;
      updateData.error_message = error_message || null;
    } else {
      // SPED specific mapping if needed, otherwise use general
      if (status === "error") {
        updateData.error_message = error_message || "Erro desconhecido no processamento SPED";
      }
    }

    const { error: updateError } = await adminClient
      .from(targetTable)
      .update(updateData)
      .eq("id", execution_id)
      .eq("tenant_id", tenant_id);

    if (updateError) {
      console.error("Update error:", updateError.message);
      return new Response(JSON.stringify({ error: "Failed to update record" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Callback error:", (err as Error).message);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
