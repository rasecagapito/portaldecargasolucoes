-- Supabase Schema Dump - v1 SPED Funcional
-- Generated at: 2026-03-20

-- 1. Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'operator', 'viewer');

-- 2. Functions
CREATE OR REPLACE FUNCTION public.get_decrypted_sap_config(p_tenant_id uuid, p_master_key text)
 RETURNS TABLE(sap_url text, sap_company_db text, sap_user text, decrypted_password text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        t.sap_url,
        t.sap_company_db,
        t.sap_user,
        extensions.pgp_sym_decrypt(t.sap_password, p_master_key)::TEXT
    FROM public.tenant_sap_configs t
    WHERE t.tenant_id = p_tenant_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_decrypted_client_sap_config(p_client_id uuid, p_tenant_id uuid, p_master_key text)
 RETURNS TABLE(sap_url text, sap_company_db text, sap_user text, decrypted_password text, source text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    -- 1. Tentar pegar a config do Cliente
    RETURN QUERY
    SELECT 
        c.sap_url,
        c.sap_company_db,
        c.sap_user,
        extensions.pgp_sym_decrypt(c.sap_password, p_master_key)::TEXT,
        'client'::TEXT as source
    FROM public.client_sap_configs c
    WHERE c.client_id = p_client_id AND c.tenant_id = p_tenant_id;

    -- 2. Se não retornar nada, tentar a config padrão do Tenant
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT 
            t.sap_url,
            t.sap_company_db,
            t.sap_user,
            extensions.pgp_sym_decrypt(t.sap_password, p_master_key)::TEXT,
            'tenant'::TEXT as source
        FROM public.tenant_sap_configs t
        WHERE t.tenant_id = p_tenant_id;
    END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
 RETURNS uuid
 LANGUAGE sql
 SECURITY DEFINER
AS $function$
  SELECT tenant_id
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, tenant_id, full_name)
  VALUES (
    NEW.id,
    (NEW.raw_user_meta_data->>'tenant_id')::UUID,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  
  INSERT INTO public.user_roles (user_id, tenant_id, role)
  VALUES (
    NEW.id,
    (NEW.raw_user_meta_data->>'tenant_id')::UUID,
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'viewer')
  );
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$function$;

CREATE OR REPLACE FUNCTION public.seed_role_modules_for_tenant(p_tenant_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

-- 3. Tables
CREATE TABLE public.tenants (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL,
    slug text NOT NULL,
    active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT tenants_pkey PRIMARY KEY (id),
    CONSTRAINT tenants_slug_key UNIQUE (slug)
);

CREATE TABLE public.profiles (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    full_name text NOT NULL,
    avatar_url text NULL,
    active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT profiles_pkey PRIMARY KEY (id),
    CONSTRAINT profiles_user_id_key UNIQUE (user_id),
    CONSTRAINT profiles_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE
);

CREATE TABLE public.user_roles (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    role public.app_role NOT NULL DEFAULT 'viewer'::public.app_role,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT user_roles_pkey PRIMARY KEY (id),
    CONSTRAINT user_roles_user_id_tenant_id_role_key UNIQUE (user_id, tenant_id, role),
    CONSTRAINT user_roles_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE
);

CREATE TABLE public.role_modules (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    role public.app_role NOT NULL,
    module text NOT NULL,
    can_view boolean NOT NULL DEFAULT false,
    can_create boolean NOT NULL DEFAULT false,
    can_edit boolean NOT NULL DEFAULT false,
    can_delete boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT role_modules_pkey PRIMARY KEY (id),
    CONSTRAINT role_modules_tenant_id_role_module_key UNIQUE (tenant_id, role, module),
    CONSTRAINT role_modules_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE
);

CREATE TABLE public.audit_logs (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    actor_id uuid NOT NULL,
    action text NOT NULL,
    target_type text NULL,
    target_id text NULL,
    details jsonb NOT NULL DEFAULT '{}'::jsonb,
    ip_address text NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT audit_logs_pkey PRIMARY KEY (id),
    CONSTRAINT audit_logs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE
);

CREATE TABLE public.cargas (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    description text NULL,
    webhook_url text NULL,
    active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT cargas_pkey PRIMARY KEY (id),
    CONSTRAINT cargas_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

CREATE TABLE public.carga_items (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    carga_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    webhook_url text NOT NULL,
    active boolean NOT NULL DEFAULT true,
    execution_order integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT carga_items_pkey PRIMARY KEY (id),
    CONSTRAINT carga_items_carga_id_fkey FOREIGN KEY (carga_id) REFERENCES public.cargas(id) ON DELETE CASCADE,
    CONSTRAINT carga_items_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

CREATE TABLE public.carga_executions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    carga_id uuid NOT NULL,
    status text NOT NULL DEFAULT 'pending'::text,
    user_id uuid NOT NULL,
    params jsonb NULL DEFAULT '{}'::jsonb,
    result jsonb NULL,
    error_message text NULL,
    started_at timestamp with time zone NULL,
    finished_at timestamp with time zone NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    carga_item_id uuid NULL,
    CONSTRAINT carga_executions_pkey PRIMARY KEY (id),
    CONSTRAINT carga_executions_carga_id_fkey FOREIGN KEY (carga_id) REFERENCES public.cargas(id),
    CONSTRAINT carga_executions_carga_item_id_fkey FOREIGN KEY (carga_item_id) REFERENCES public.carga_items(id),
    CONSTRAINT carga_executions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
    CONSTRAINT carga_executions_status_check CHECK (status = ANY (ARRAY['pending'::text, 'running'::text, 'success'::text, 'error'::text, 'cancelled'::text]))
);

CREATE TABLE public.tenant_sap_configs (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    sap_url text NOT NULL,
    sap_company_db text NOT NULL,
    sap_user text NOT NULL,
    sap_password text NOT NULL,
    active boolean NULL DEFAULT true,
    created_at timestamp with time zone NULL DEFAULT now(),
    updated_at timestamp with time zone NULL DEFAULT now(),
    CONSTRAINT tenant_sap_configs_pkey PRIMARY KEY (id),
    CONSTRAINT tenant_sap_configs_tenant_id_key UNIQUE (tenant_id),
    CONSTRAINT tenant_sap_configs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE
);

CREATE TABLE public.clients (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    cnpj text NULL,
    active boolean NULL DEFAULT true,
    created_at timestamp with time zone NULL DEFAULT now(),
    CONSTRAINT clients_pkey PRIMARY KEY (id),
    CONSTRAINT clients_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

CREATE TABLE public.client_sap_configs (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    client_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    sap_url text NOT NULL,
    sap_company_db text NOT NULL,
    sap_user text NOT NULL,
    sap_password bytea NULL,
    active boolean NULL DEFAULT true,
    created_at timestamp with time zone NULL DEFAULT now(),
    updated_at timestamp with time zone NULL DEFAULT now(),
    CONSTRAINT client_sap_configs_pkey PRIMARY KEY (id),
    CONSTRAINT client_sap_configs_client_id_key UNIQUE (client_id),
    CONSTRAINT client_sap_configs_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id),
    CONSTRAINT client_sap_configs_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

CREATE TABLE public.sped_uploads (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    client_id uuid NOT NULL,
    file_path text NOT NULL,
    status text NULL DEFAULT 'pending'::text,
    result_log jsonb NULL,
    created_at timestamp with time zone NULL DEFAULT now(),
    updated_at timestamp with time zone NULL DEFAULT now(),
    user_id uuid NULL,
    CONSTRAINT sped_uploads_pkey PRIMARY KEY (id),
    CONSTRAINT sped_uploads_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id),
    CONSTRAINT sped_uploads_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

-- 4. Enable RLS
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cargas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carga_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carga_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_sap_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_sap_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sped_uploads ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
CREATE POLICY "Users can view their own tenant" ON public.tenants FOR SELECT USING (id = get_user_tenant_id());

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can view profiles in their tenant" ON public.profiles FOR SELECT USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Admins can manage roles in their tenant" ON public.user_roles FOR ALL USING ((tenant_id = get_user_tenant_id()) AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view roles in their tenant" ON public.user_roles FOR SELECT USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Admins can manage role_modules in their tenant" ON public.role_modules FOR ALL USING ((tenant_id = get_user_tenant_id()) AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view role_modules in their tenant" ON public.role_modules FOR SELECT USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Admins can view audit_logs in their tenant" ON public.audit_logs FOR SELECT USING ((tenant_id = get_user_tenant_id()) AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can create audit logs for themselves" ON public.audit_logs FOR INSERT WITH CHECK ((auth.uid() = actor_id) AND (tenant_id = get_user_tenant_id()));

CREATE POLICY "Admins manage tenant_sap_configs" ON public.tenant_sap_configs FOR ALL USING ((tenant_id = get_user_tenant_id()) AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins and operators can create executions" ON public.carga_executions FOR INSERT WITH CHECK ((tenant_id = get_user_tenant_id()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role)));
CREATE POLICY "Users can view carga_executions in their tenant" ON public.carga_executions FOR SELECT USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Admins can create cargas" ON public.cargas FOR INSERT WITH CHECK ((tenant_id = get_user_tenant_id()) AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete cargas" ON public.cargas FOR DELETE USING ((tenant_id = get_user_tenant_id()) AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update cargas" ON public.cargas FOR UPDATE USING ((tenant_id = get_user_tenant_id()) AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view cargas in their tenant" ON public.cargas FOR SELECT USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Admins can create carga_items" ON public.carga_items FOR INSERT WITH CHECK ((tenant_id = get_user_tenant_id()) AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete carga_items" ON public.carga_items FOR DELETE USING ((tenant_id = get_user_tenant_id()) AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update carga_items" ON public.carga_items FOR UPDATE USING ((tenant_id = get_user_tenant_id()) AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view carga_items in their tenant" ON public.carga_items FOR SELECT USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Admins can manage clients" ON public.clients FOR ALL USING ((tenant_id = get_user_tenant_id()) AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view clients in their tenant" ON public.clients FOR SELECT USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Admins manage client_sap_configs" ON public.client_sap_configs FOR ALL USING ((tenant_id = get_user_tenant_id()) AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view client_sap_configs in their tenant" ON public.client_sap_configs FOR SELECT USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Admins/Operators can manage sped_uploads" ON public.sped_uploads FOR ALL USING ((tenant_id = get_user_tenant_id()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'operator'::app_role)));
CREATE POLICY "Users can view sped_uploads in their tenant" ON public.sped_uploads FOR SELECT USING (tenant_id = get_user_tenant_id());

-- 6. Indexes
CREATE UNIQUE INDEX tenants_pkey ON public.tenants USING btree (id);
CREATE UNIQUE INDEX tenants_slug_key ON public.tenants USING btree (slug);
CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id);
CREATE UNIQUE INDEX profiles_user_id_key ON public.profiles USING btree (user_id);
CREATE INDEX idx_profiles_tenant_user ON public.profiles USING btree (tenant_id, user_id);
CREATE UNIQUE INDEX user_roles_pkey ON public.user_roles USING btree (id);
CREATE UNIQUE INDEX user_roles_user_id_tenant_id_role_key ON public.user_roles USING btree (user_id, tenant_id, role);
CREATE INDEX idx_user_roles_tenant_user ON public.user_roles USING btree (tenant_id, user_id);
CREATE UNIQUE INDEX role_modules_pkey ON public.role_modules USING btree (id);
CREATE UNIQUE INDEX role_modules_tenant_id_role_module_key ON public.role_modules USING btree (tenant_id, role, module);
CREATE INDEX idx_role_modules_tenant_role ON public.role_modules USING btree (tenant_id, role);
CREATE UNIQUE INDEX audit_logs_pkey ON public.audit_logs USING btree (id);
CREATE INDEX idx_audit_logs_tenant_created ON public.audit_logs USING btree (tenant_id, created_at DESC);
CREATE INDEX idx_audit_logs_action ON public.audit_logs USING btree (tenant_id, action);
CREATE UNIQUE INDEX tenant_sap_configs_pkey ON public.tenant_sap_configs USING btree (id);
CREATE UNIQUE INDEX tenant_sap_configs_tenant_id_key ON public.tenant_sap_configs USING btree (tenant_id);
CREATE UNIQUE INDEX carga_executions_pkey ON public.carga_executions USING btree (id);
CREATE INDEX idx_carga_executions_tenant_id ON public.carga_executions USING btree (tenant_id);
CREATE INDEX idx_carga_executions_carga_id ON public.carga_executions USING btree (carga_id);
CREATE INDEX idx_carga_executions_status ON public.carga_executions USING btree (status);
CREATE UNIQUE INDEX cargas_pkey ON public.cargas USING btree (id);
CREATE INDEX idx_cargas_tenant_id ON public.cargas USING btree (tenant_id);
CREATE UNIQUE INDEX carga_items_pkey ON public.carga_items USING btree (id);
CREATE UNIQUE INDEX clients_pkey ON public.clients USING btree (id);
CREATE UNIQUE INDEX client_sap_configs_pkey ON public.client_sap_configs USING btree (id);
CREATE UNIQUE INDEX client_sap_configs_client_id_key ON public.client_sap_configs USING btree (client_id);
CREATE UNIQUE INDEX sped_uploads_pkey ON public.sped_uploads USING btree (id);
CREATE INDEX idx_sped_uploads_tenant ON public.sped_uploads USING btree (tenant_id);
CREATE INDEX idx_sped_uploads_client ON public.sped_uploads USING btree (client_id);

-- 7. Triggers
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON public.tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_role_modules_updated_at BEFORE UPDATE ON public.role_modules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cargas_updated_at BEFORE UPDATE ON public.cargas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_carga_items_updated_at BEFORE UPDATE ON public.carga_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tenant_sap_configs_updated_at BEFORE UPDATE ON public.tenant_sap_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER upd_tenant_sap BEFORE UPDATE ON public.tenant_sap_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER upd_client_sap BEFORE UPDATE ON public.client_sap_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
