
-- ═══════════════════════════════════════════
-- ROLE_MODULES: controle de acesso por role
-- ═══════════════════════════════════════════

CREATE TABLE public.role_modules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  module TEXT NOT NULL,
  can_view BOOLEAN NOT NULL DEFAULT false,
  can_create BOOLEAN NOT NULL DEFAULT false,
  can_edit BOOLEAN NOT NULL DEFAULT false,
  can_delete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, role, module)
);

ALTER TABLE public.role_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view role_modules in their tenant"
ON public.role_modules FOR SELECT
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Admins can manage role_modules in their tenant"
ON public.role_modules FOR ALL
USING (tenant_id = get_user_tenant_id() AND has_role(auth.uid(), 'admin'));

CREATE INDEX idx_role_modules_tenant_role ON public.role_modules(tenant_id, role);

CREATE TRIGGER update_role_modules_updated_at
BEFORE UPDATE ON public.role_modules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ═══════════════════════════════════════════
-- AUDIT_LOGS: registro imutável de ações
-- ═══════════════════════════════════════════

CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit_logs in their tenant"
ON public.audit_logs FOR SELECT
USING (tenant_id = get_user_tenant_id() AND has_role(auth.uid(), 'admin'));

-- Insert policy for edge functions using service_role (no RLS bypass needed for service role)
-- No INSERT/UPDATE/DELETE policies for regular users - only edge functions with service_role can write

CREATE INDEX idx_audit_logs_tenant_created ON public.audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(tenant_id, action);

-- ═══════════════════════════════════════════
-- SEED: permissões padrão para roles existentes
-- ═══════════════════════════════════════════

-- This function seeds role_modules for a tenant with default permissions
CREATE OR REPLACE FUNCTION public.seed_role_modules_for_tenant(p_tenant_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Admin: full access
  INSERT INTO public.role_modules (tenant_id, role, module, can_view, can_create, can_edit, can_delete) VALUES
    (p_tenant_id, 'admin', 'dashboard', true, true, true, true),
    (p_tenant_id, 'admin', 'cargas', true, true, true, true),
    (p_tenant_id, 'admin', 'usuarios', true, true, true, true),
    (p_tenant_id, 'admin', 'configuracoes', true, true, true, true)
  ON CONFLICT (tenant_id, role, module) DO NOTHING;

  -- Operator: dashboard + cargas
  INSERT INTO public.role_modules (tenant_id, role, module, can_view, can_create, can_edit, can_delete) VALUES
    (p_tenant_id, 'operator', 'dashboard', true, false, false, false),
    (p_tenant_id, 'operator', 'cargas', true, true, true, false),
    (p_tenant_id, 'operator', 'usuarios', false, false, false, false),
    (p_tenant_id, 'operator', 'configuracoes', false, false, false, false)
  ON CONFLICT (tenant_id, role, module) DO NOTHING;

  -- Viewer: dashboard + view cargas
  INSERT INTO public.role_modules (tenant_id, role, module, can_view, can_create, can_edit, can_delete) VALUES
    (p_tenant_id, 'viewer', 'dashboard', true, false, false, false),
    (p_tenant_id, 'viewer', 'cargas', true, false, false, false),
    (p_tenant_id, 'viewer', 'usuarios', false, false, false, false),
    (p_tenant_id, 'viewer', 'configuracoes', false, false, false, false)
  ON CONFLICT (tenant_id, role, module) DO NOTHING;
END;
$$;

-- Seed for all existing tenants
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN SELECT id FROM public.tenants LOOP
    PERFORM public.seed_role_modules_for_tenant(t.id);
  END LOOP;
END;
$$;
