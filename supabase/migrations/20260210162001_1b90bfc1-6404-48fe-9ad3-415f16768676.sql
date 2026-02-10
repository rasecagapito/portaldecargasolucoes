CREATE POLICY "Users can create audit logs for themselves"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = actor_id AND tenant_id = get_user_tenant_id());