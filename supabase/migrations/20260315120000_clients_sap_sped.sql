-- Habilitar pgcrypto (necessario para criptografia de senhas SAP)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- CLIENTS
CREATE TABLE IF NOT EXISTS public.clients (
  id         UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id  UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  cnpj       TEXT,
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users view clients') THEN
        ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "Users view clients" ON public.clients FOR SELECT USING (tenant_id = get_user_tenant_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Admins manage clients') THEN
        CREATE POLICY "Admins manage clients" ON public.clients FOR ALL USING (tenant_id = get_user_tenant_id() AND has_role(auth.uid(), 'admin'));
    END IF;
END
$$;

-- TENANT_SAP_CONFIGS
CREATE TABLE IF NOT EXISTS public.tenant_sap_configs (
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

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Admins manage tenant_sap_configs') THEN
        ALTER TABLE public.tenant_sap_configs ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "Admins manage tenant_sap_configs" ON public.tenant_sap_configs FOR ALL USING (tenant_id = get_user_tenant_id() AND has_role(auth.uid(), 'admin'));
    END IF;
END
$$;

DROP TRIGGER IF EXISTS upd_tenant_sap ON public.tenant_sap_configs;
CREATE TRIGGER upd_tenant_sap BEFORE UPDATE ON public.tenant_sap_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- CLIENT_SAP_CONFIGS
CREATE TABLE IF NOT EXISTS public.client_sap_configs (
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

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Admins manage client_sap_configs') THEN
        ALTER TABLE public.client_sap_configs ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "Admins manage client_sap_configs" ON public.client_sap_configs FOR ALL USING (tenant_id = get_user_tenant_id() AND has_role(auth.uid(), 'admin'));
    END IF;
END
$$;

DROP TRIGGER IF EXISTS upd_client_sap ON public.client_sap_configs;
CREATE TRIGGER upd_client_sap BEFORE UPDATE ON public.client_sap_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SPED_UPLOADS
CREATE TABLE IF NOT EXISTS public.sped_uploads (
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

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users view sped_uploads') THEN
        ALTER TABLE public.sped_uploads ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "Users view sped_uploads" ON public.sped_uploads FOR SELECT USING (tenant_id = get_user_tenant_id());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Operators create sped_uploads') THEN
        CREATE POLICY "Operators create sped_uploads" ON public.sped_uploads FOR INSERT WITH CHECK (
            tenant_id = get_user_tenant_id()
            AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator'))
        );
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_sped_uploads_tenant ON public.sped_uploads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sped_uploads_client ON public.sped_uploads(client_id);

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
