# Portal de Automação B1 — Plano de Implementação & Documentação

> Última atualização: 2026-03-15
> Objetivo: Finalizar a conexão Portal <-> n8n para o fluxo **1 - CARGA PN SPED**

---

## 1. VISÃO GERAL DA ARQUITETURA

```
USUÁRIO (Browser)
  React + TypeScript + Vite
         |
         | HTTP (Bearer token)
         v
SUPABASE (Backend)
  Edge Functions (Deno):
    - dispatch-carga          [OK]
    - dispatch-carga-sped     [INCOMPLETO]
    - carga-callback          [OK]
    - manage-users/perms      [OK]

  PostgreSQL (RLS ativo):
    - tenants, profiles, user_roles, role_modules
    - cargas, carga_items, carga_executions        [OK - migrations existem]
    - clients, client_sap_configs                  [PENDENTE - sem migration]
    - tenant_sap_configs                           [PENDENTE - sem migration]
    - sped_uploads                                 [PENDENTE - sem migration]
    - audit_logs                                   [OK]

  Storage:
    - bucket "sped-files"                          [PENDENTE - criar]
         |
         | POST webhook (HTTP)
         v
n8n Cloud (tododiasoftware.app.n8n.cloud)
  Workflow: 1 - CARGA PN SPED (#TOCb7dM9JPWf2Ty9)
  [Webhook] -> [SAP Config] -> [EXCEL] -> loop CNPJs
    -> BrasilAPI -> Montar BP -> Login SAP -> Check/Create/Update BP
    -> [Callback -> Supabase carga-callback]
         |
         | PATCH/POST (SAP Service Layer REST API)
         v
SAP Business One (B1)
```

---

## 2. FLUXO DETALHADO: CARGA PN SPED

### 2.1 O que o workflow faz

O workflow **1 - CARGA PN SPED** processa um arquivo Excel com CNPJs de
Parceiros de Negócios (PN) e:

1. Le o Excel com lista de CNPJs e dados do cliente SAP
2. Valida cada CNPJ (14 digitos)
3. Processa em lotes de 20 CNPJs por vez
4. Para cada CNPJ valido: consulta a BrasilAPI para obter dados cadastrais
5. Monta o payload do Business Partner (OCRD + CRD1 + CRD7) no formato SAP
6. Faz login no SAP Service Layer
7. Verifica se o BP ja existe (GET BusinessPartners)
8. Se existe -> PATCH (atualiza); se nao -> POST (cria)
9. Chama o callback_url com o resultado

### 2.2 Mapa de nos do workflow (extraido de flow.txt)

```
[Webhook]
  -> [SAP Config]               <- le sap_url/db/user/pass do body
       -> [EXCEL]               <- le arquivo .xlsx (via file_url)
            -> [Juncao SAP+Excel SUB]
                 -> [Alinhamento Tabelas]
                      -> [Tirar Caracteres Especiais1]
                           -> [Validar 14 Caracteres]
                                |-> [OK] -> [Guardar Entrada]
                                |           -> [CNPJ de 20 em 20]  (loop)
                                |                |-> [Ordenacao Final] -> [Resultado final]
                                |                -> [Consultar CNPJ (BrasilAPI)]
                                |                     -> [MERGE (Entrada + Resposta)]
                                |                          -> [HTTP 200?]
                                |                               |-> [Montar CRD7 Contabil/Cobranca/Entrega]
                                |                               |-> [OCRD Montar dados] -> [OCRD Build payload]
                                |                               |-> [Juncao OCNT+CRD1] -> CRD1 enderecos
                                |                               -> [SUB-OCNT-COUNTY]
                                |                    [Login SAP B] -> [SL Save Session] -> [SL Build Cookie]
                                |                         -> [Set Injetar sessao]
                                |                              -> [HTTP Check BP GET]
                                |                                   -> [IF BP existe?]
                                |                                        |-> [Sim] -> PATCH
                                |                                        -> [Nao] -> POST -> [Wait] -> loop
                                -> [ERRO CNPJ] -> [Conversao XLS Erro] -> [Upload XLSX]
```

### 2.3 O que o n8n espera receber no Webhook

```json
{
  "id":             "uuid-do-sped-upload",
  "tenant_id":      "uuid-do-tenant",
  "client_id":      "uuid-do-cliente",
  "file_path":      "sped/tenant-id/arquivo.xlsx",
  "file_url":       "https://...supabase.co/storage/v1/object/sign/...",
  "callback_url":   "https://[project].supabase.co/functions/v1/carga-callback",
  "sap_url":        "https://sap-server:50000",
  "sap_company_db": "NOME_DB",
  "sap_user":       "manager",
  "sap_password":   "senha-plaintext-descriptografada"
}
```

ATENCAO: O no SAP Config mapeia $json.body.sap_*
         O no EXCEL precisa de file_url (URL assinada do Supabase Storage)

---

## 3. ESTADO ATUAL DO CODIGO

### Completo [OK]
- dispatch-carga: injeta SAP via get_decrypted_sap_config RPC
- carga-callback: suporta entity_type "sped" e "carga"
- CargasPage.tsx: gestao completa de cargas (~62KB)
- ConfiguracoesPage.tsx: aba SAP configurada (tenant-level)
- App.tsx + Sidebar.tsx: rota /clientes adicionada
- Migrations: tenants, profiles, user_roles, cargas, carga_items, carga_executions, audit_logs

### Incompleto [PENDENTE]
- dispatch-carga-sped: NAO injeta SAP; NAO gera signed URL do arquivo
- Migrations: clients, client_sap_configs, tenant_sap_configs, sped_uploads AUSENTES
- RPC get_decrypted_client_sap_config: AUSENTE
- Bucket sped-files no Storage: AUSENTE
- ClientesPage.tsx: implementada mas sem tabelas no banco
- No EXCEL no n8n: verificar se aceita file_url dinamico
- Callback no n8n: verificar se envia HMAC corretamente

---

## 4. WALKTHROUGH — PASSOS PARA FINALIZAR

=============================================================
PASSO 1 — Migration: tabelas pendentes
=============================================================

Criar arquivo: supabase/migrations/[TIMESTAMP]_clients_sap_sped.sql

```sql
-- Habilitar pgcrypto (necessario para criptografia de senhas SAP)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- CLIENTS
CREATE TABLE public.clients (
  id         UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id  UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  cnpj       TEXT,
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view clients" ON public.clients FOR SELECT
  USING (tenant_id = get_user_tenant_id());
CREATE POLICY "Admins manage clients" ON public.clients FOR ALL
  USING (tenant_id = get_user_tenant_id() AND has_role(auth.uid(), 'admin'));

-- TENANT_SAP_CONFIGS
CREATE TABLE public.tenant_sap_configs (
  id             UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id      UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE,
  sap_url        TEXT NOT NULL,
  sap_company_db TEXT NOT NULL,
  sap_user       TEXT NOT NULL,
  sap_password   TEXT NOT NULL,
  active         BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tenant_sap_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage tenant_sap_configs" ON public.tenant_sap_configs FOR ALL
  USING (tenant_id = get_user_tenant_id() AND has_role(auth.uid(), 'admin'));
CREATE TRIGGER upd_tenant_sap BEFORE UPDATE ON public.tenant_sap_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- CLIENT_SAP_CONFIGS
CREATE TABLE public.client_sap_configs (
  id             UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id      UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE UNIQUE,
  tenant_id      UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sap_url        TEXT NOT NULL,
  sap_company_db TEXT NOT NULL,
  sap_user       TEXT NOT NULL,
  sap_password   TEXT NOT NULL,
  active         BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.client_sap_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage client_sap_configs" ON public.client_sap_configs FOR ALL
  USING (tenant_id = get_user_tenant_id() AND has_role(auth.uid(), 'admin'));
CREATE TRIGGER upd_client_sap BEFORE UPDATE ON public.client_sap_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SPED_UPLOADS
CREATE TABLE public.sped_uploads (
  id            UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id     UUID REFERENCES public.clients(id),
  user_id       UUID NOT NULL,
  file_path     TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'processing'
                CHECK (status IN ('processing', 'success', 'error')),
  error_message TEXT,
  finished_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sped_uploads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view sped_uploads" ON public.sped_uploads FOR SELECT
  USING (tenant_id = get_user_tenant_id());
CREATE POLICY "Operators create sped_uploads" ON public.sped_uploads FOR INSERT
  WITH CHECK (
    tenant_id = get_user_tenant_id()
    AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator'))
  );
CREATE INDEX idx_sped_uploads_tenant ON public.sped_uploads(tenant_id);
CREATE INDEX idx_sped_uploads_client ON public.sped_uploads(client_id);
```

=============================================================
PASSO 2 — Migration: RPC de decrypt com fallback cliente -> tenant
=============================================================

```sql
-- RPC: get_decrypted_sap_config (TENANT-LEVEL) — verificar se ja existe
-- Se nao existir, criar:
CREATE OR REPLACE FUNCTION public.get_decrypted_sap_config(
  p_tenant_id  UUID,
  p_master_key TEXT
)
RETURNS TABLE(sap_url TEXT, sap_company_db TEXT, sap_user TEXT, decrypted_password TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT t.sap_url, t.sap_company_db, t.sap_user,
         pgp_sym_decrypt(t.sap_password::bytea, p_master_key)
  FROM public.tenant_sap_configs t
  WHERE t.tenant_id = p_tenant_id AND t.active = true
  LIMIT 1;
END;
$$;

-- RPC: get_decrypted_client_sap_config (CLIENT com fallback TENANT)
CREATE OR REPLACE FUNCTION public.get_decrypted_client_sap_config(
  p_client_id  UUID,
  p_tenant_id  UUID,
  p_master_key TEXT
)
RETURNS TABLE(sap_url TEXT, sap_company_db TEXT, sap_user TEXT, decrypted_password TEXT, source TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_client public.client_sap_configs%ROWTYPE;
  v_tenant public.tenant_sap_configs%ROWTYPE;
BEGIN
  -- Tenta config do cliente primeiro
  SELECT * INTO v_client FROM public.client_sap_configs
  WHERE client_id = p_client_id AND tenant_id = p_tenant_id AND active = true LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT v_client.sap_url, v_client.sap_company_db, v_client.sap_user,
      pgp_sym_decrypt(v_client.sap_password::bytea, p_master_key), 'client'::TEXT;
    RETURN;
  END IF;

  -- Fallback: config do tenant
  SELECT * INTO v_tenant FROM public.tenant_sap_configs
  WHERE tenant_id = p_tenant_id AND active = true LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT v_tenant.sap_url, v_tenant.sap_company_db, v_tenant.sap_user,
      pgp_sym_decrypt(v_tenant.sap_password::bytea, p_master_key), 'tenant'::TEXT;
    RETURN;
  END IF;
END;
$$;
```

=============================================================
PASSO 3 — Criar bucket no Supabase Storage
=============================================================

Via Supabase Dashboard -> Storage -> New Bucket:
  - Nome: sped-files
  - Publico: NAO (privado)

Via SQL Editor:
```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('sped-files', 'sped-files', false)
ON CONFLICT DO NOTHING;

CREATE POLICY "Autenticados podem fazer upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'sped-files');

CREATE POLICY "Usuarios acessam arquivos do seu tenant"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'sped-files'
  AND (storage.foldername(name))[1] = get_user_tenant_id()::TEXT);
```

=============================================================
PASSO 4 — Atualizar dispatch-carga-sped Edge Function
=============================================================

Arquivo: supabase/functions/dispatch-carga-sped/index.ts

Mudancas necessarias (apos validar auth e obter profile.tenant_id):

```typescript
// 1. Buscar SAP config (cliente com fallback tenant)
const { data: sapConfig, error: sapError } = await adminClient
  .rpc('get_decrypted_client_sap_config', {
    p_client_id: client_id,
    p_tenant_id: profile.tenant_id,
    p_master_key: Deno.env.get("SAP_MASTER_KEY") || ""
  })
  .maybeSingle();

if (sapError || !sapConfig) {
  return new Response(
    JSON.stringify({ error: "Configuracao SAP nao encontrada" }),
    { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// 2. Gerar signed URL do arquivo (valida por 1 hora)
const { data: signedUrlData, error: signedUrlError } = await adminClient
  .storage.from('sped-files').createSignedUrl(file_path, 3600);

if (signedUrlError || !signedUrlData) {
  return new Response(
    JSON.stringify({ error: "Erro ao gerar URL do arquivo" }),
    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// 3. Criar registro em sped_uploads (igual ao atual - OK)
const { data: record, ... } = await adminClient.from("sped_uploads").insert({...}).select("id").single();

// 4. Disparar n8n com payload COMPLETO
const n8nWebhookUrl = Deno.env.get("N8N_SPED_WEBHOOK_URL")
  || "https://tododiasoftware.app.n8n.cloud/webhook/dispatch-carga-sped";

const resp = await fetch(n8nWebhookUrl, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    id:             record.id,
    tenant_id:      profile.tenant_id,
    client_id:      client_id,
    file_path:      file_path,
    file_url:       signedUrlData.signedUrl,   // <- URL para o no EXCEL baixar
    callback_url:   `${supabaseUrl}/functions/v1/carga-callback`,
    sap_url:        sapConfig.sap_url,
    sap_company_db: sapConfig.sap_company_db,
    sap_user:       sapConfig.sap_user,
    sap_password:   sapConfig.decrypted_password,
  })
});
```

=============================================================
PASSO 5 — Secrets no Supabase
=============================================================

Supabase Dashboard -> Edge Functions -> Manage Secrets:

| Variavel             | Descricao                                        |
|----------------------|--------------------------------------------------|
| SAP_MASTER_KEY       | Chave para criptografar/descriptografar senhas   |
| N8N_WEBHOOK_SECRET   | HMAC secret para validar callbacks do n8n        |
| N8N_SPED_WEBHOOK_URL | URL do webhook n8n (prod, nao test)              |

=============================================================
PASSO 6 — Ajustar no EXCEL no n8n
=============================================================

O no [EXCEL] no workflow precisa ler file_url dinamicamente:

Opcao A (recomendado): Adicionar no HTTP Request antes do EXCEL
  - URL: {{ $json.body.file_url }}
  - Method: GET
  - Response: Binary
  - Conectar saida binaria ao no Spreadsheet File

Opcao B: Se o no Spreadsheet File ja suporta URL:
  - Configurar para ler de: {{ $('Webhook').item.json.body.file_url }}

=============================================================
PASSO 7 — Callback do n8n para o Supabase
=============================================================

Ao final do workflow, adicionar no HTTP Request:

  URL:    {{ $('Webhook').item.json.body.callback_url }}
  Method: POST
  Headers:
    Content-Type: application/json
    x-n8n-signature: [HMAC-SHA256 do body com N8N_WEBHOOK_SECRET]
  Body:
    {
      "execution_id": "{{ $('Webhook').item.json.body.id }}",
      "tenant_id":    "{{ $('Webhook').item.json.body.tenant_id }}",
      "entity_type":  "sped",
      "status":       "success"
    }

Para erros, status = "error" com campo error_message.

---

## 5. CHECKLIST

### Banco de dados
- [ ] pgcrypto habilitado
- [ ] Tabela clients criada com RLS
- [ ] Tabela tenant_sap_configs criada com RLS
- [ ] Tabela client_sap_configs criada com RLS
- [ ] Tabela sped_uploads criada com RLS e campo finished_at
- [ ] RPC get_decrypted_sap_config existe (para dispatch-carga)
- [ ] RPC get_decrypted_client_sap_config existe (para dispatch-carga-sped)
- [ ] Bucket sped-files criado com politicas de acesso

### Edge Functions
- [ ] dispatch-carga deployada e funcionando
- [ ] dispatch-carga-sped atualizada (SAP inject + signed URL)
- [ ] carga-callback deployada (suporta entity_type=sped)
- [ ] Secrets configurados: SAP_MASTER_KEY, N8N_WEBHOOK_SECRET, N8N_SPED_WEBHOOK_URL

### Frontend
- [ ] ClientesPage funciona com tabelas reais do banco
- [ ] Rota /clientes acessivel via Sidebar (modulo configuracoes)
- [ ] UI de upload de arquivo SPED implementada
- [ ] Chamada a dispatch-carga-sped a partir da UI

### n8n
- [ ] Webhook /dispatch-carga-sped ativo em modo PRODUCAO (nao test)
- [ ] No SAP Config lendo os campos do body corretamente
- [ ] No EXCEL recebendo file_url e baixando arquivo
- [ ] No de callback chamando carga-callback com HMAC
- [ ] Workflow ativo sem erros

---

## 6. FLUXO COMPLETO (SEQUENCIA)

```
1. Usuario -> ClientesPage -> seleciona cliente -> upload arquivo SPED

2. Frontend:
   POST /storage/v1/object/sped-files/{tenant_id}/arquivo.xlsx
   -> Storage retorna file_path

3. Frontend -> dispatch-carga-sped:
   POST /functions/v1/dispatch-carga-sped
   Body: { client_id, file_path }
   Auth: Bearer {user_token}

4. dispatch-carga-sped:
   a. Valida auth + role
   b. Busca tenant_id do profile
   c. RPC get_decrypted_client_sap_config -> sap_url, db, user, pass
   d. Storage.createSignedUrl(file_path, 3600) -> signed URL
   e. INSERT sped_uploads (status=processing)
   f. POST n8n webhook com payload completo
   g. Retorna { success: true, id: sped_upload_id }

5. n8n executa workflow:
   a. SAP Config: extrai credenciais
   b. HTTP Request: baixa arquivo via file_url
   c. EXCEL: processa planilha de CNPJs
   d. Loop 20 CNPJs por vez:
      - BrasilAPI: enriquece dados cadastrais
      - Monta BP (OCRD + CRD1 + CRD7)
      - Login SAP Service Layer
      - GET BusinessPartner -> existe?
        Sim -> PATCH | Nao -> POST
   e. POST callback_url com resultado

6. carga-callback:
   a. Valida HMAC (x-n8n-signature)
   b. UPDATE sped_uploads SET status=success, finished_at=now()
   c. Retorna { success: true }

7. Frontend (polling ou realtime Supabase):
   Exibe status atualizado
```

---

## 7. OBSERVACOES IMPORTANTES

### Criptografia das senhas SAP
- Salvar: pgp_sym_encrypt('senha', SAP_MASTER_KEY)
- Nunca expor SAP_MASTER_KEY no frontend
- Nunca retornar a senha descriptografada para o frontend
- A descriptografia ocorre apenas dentro da Edge Function

### Multi-tenancy
- Toda tabela tem tenant_id com RLS ativo
- Edge Functions usam service_role para bypassar RLS
- tenant_id sempre obtido do profile autenticado, nunca do request body

### Signed URL do Storage
- Expira em 1 hora (suficiente para processamento)
- O n8n deve processar dentro deste tempo
- Se o workflow for muito longo, aumentar para 2h (7200 segundos)

### Webhook n8n em Producao
- Modo "Test" do n8n nao fica ativo permanentemente
- Ativar o workflow e usar a URL de producao (sem /test/)
- URL producao: .../webhook/dispatch-carga-sped
- URL teste:    .../webhook-test/dispatch-carga-sped

---

## 8. ORDEM RECOMENDADA DE EXECUCAO

FASE 1 - Banco de dados
  1. Habilitar pgcrypto
  2. Criar migration: clients, tenant_sap_configs, client_sap_configs, sped_uploads
  3. Criar RPCs de decrypt
  4. Criar bucket sped-files no Storage

FASE 2 - Edge Function
  5. Atualizar dispatch-carga-sped
  6. Configurar secrets no Supabase

FASE 3 - n8n
  7. Ajustar no EXCEL para file_url dinamico
  8. Adicionar no de callback com HMAC
  9. Ativar webhook em modo producao

FASE 4 - Frontend
  10. Verificar ClientesPage com tabelas reais
  11. Implementar UI de upload SPED
  12. Integrar chamada dispatch-carga-sped

FASE 5 - Validacao
  13. Teste end-to-end com CNPJ real
  14. Verificar sped_uploads atualizado apos callback
  15. Verificar BP criado/atualizado no SAP B1

---

Documentacao gerada em 2026-03-15
