
-- Tabela cargas (definições de workflows)
CREATE TABLE public.cargas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  description TEXT,
  webhook_url TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela carga_executions (histórico de execuções)
CREATE TABLE public.carga_executions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  carga_id UUID NOT NULL REFERENCES public.cargas(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'error')),
  user_id UUID NOT NULL,
  params JSONB DEFAULT '{}'::jsonb,
  result JSONB,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  finished_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_cargas_tenant_id ON public.cargas(tenant_id);
CREATE INDEX idx_carga_executions_tenant_id ON public.carga_executions(tenant_id);
CREATE INDEX idx_carga_executions_carga_id ON public.carga_executions(carga_id);
CREATE INDEX idx_carga_executions_status ON public.carga_executions(status);

-- Enable RLS
ALTER TABLE public.cargas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carga_executions ENABLE ROW LEVEL SECURITY;

-- RLS: Cargas - todos do tenant podem visualizar
CREATE POLICY "Users can view cargas in their tenant"
ON public.cargas FOR SELECT
USING (tenant_id = get_user_tenant_id());

-- RLS: Cargas - apenas admin pode criar
CREATE POLICY "Admins can create cargas"
ON public.cargas FOR INSERT
WITH CHECK (tenant_id = get_user_tenant_id() AND has_role(auth.uid(), 'admin'));

-- RLS: Cargas - apenas admin pode editar
CREATE POLICY "Admins can update cargas"
ON public.cargas FOR UPDATE
USING (tenant_id = get_user_tenant_id() AND has_role(auth.uid(), 'admin'));

-- RLS: Cargas - apenas admin pode deletar
CREATE POLICY "Admins can delete cargas"
ON public.cargas FOR DELETE
USING (tenant_id = get_user_tenant_id() AND has_role(auth.uid(), 'admin'));

-- RLS: Executions - todos do tenant podem visualizar
CREATE POLICY "Users can view carga_executions in their tenant"
ON public.carga_executions FOR SELECT
USING (tenant_id = get_user_tenant_id());

-- RLS: Executions - admin e operator podem criar (disparar)
CREATE POLICY "Admins and operators can create executions"
ON public.carga_executions FOR INSERT
WITH CHECK (
  tenant_id = get_user_tenant_id() 
  AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'operator'))
);

-- Trigger updated_at para cargas
CREATE TRIGGER update_cargas_updated_at
BEFORE UPDATE ON public.cargas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
