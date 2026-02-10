
-- Create carga_items (children of cargas/modules)
CREATE TABLE public.carga_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  carga_id UUID NOT NULL REFERENCES public.cargas(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  name TEXT NOT NULL,
  webhook_url TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  execution_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.carga_items ENABLE ROW LEVEL SECURITY;

-- RLS policies (same pattern as cargas)
CREATE POLICY "Users can view carga_items in their tenant"
ON public.carga_items FOR SELECT
USING (tenant_id = get_user_tenant_id());

CREATE POLICY "Admins can create carga_items"
ON public.carga_items FOR INSERT
WITH CHECK (tenant_id = get_user_tenant_id() AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update carga_items"
ON public.carga_items FOR UPDATE
USING (tenant_id = get_user_tenant_id() AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete carga_items"
ON public.carga_items FOR DELETE
USING (tenant_id = get_user_tenant_id() AND has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_carga_items_updated_at
BEFORE UPDATE ON public.carga_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add carga_item_id to carga_executions (nullable for backward compat)
ALTER TABLE public.carga_executions
ADD COLUMN carga_item_id UUID REFERENCES public.carga_items(id);

-- Remove webhook_url from cargas (module no longer has its own webhook)
-- Actually, keep it for backward compat but it won't be used for new items
-- Instead, make it nullable
ALTER TABLE public.cargas ALTER COLUMN webhook_url DROP NOT NULL;
