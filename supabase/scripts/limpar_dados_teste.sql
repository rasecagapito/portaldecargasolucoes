-- ============================================
-- LIMPAR DADOS DE TESTE
-- Reseta dados sem perder estrutura/configuração
-- ATENÇÃO: Não executar em produção!
-- Executar no SQL Editor do Supabase
-- ============================================

TRUNCATE public.sped_uploads CASCADE;
TRUNCATE public.carga_executions CASCADE;
TRUNCATE public.client_sap_configs CASCADE;
TRUNCATE public.clients CASCADE;
TRUNCATE public.audit_logs CASCADE;
TRUNCATE public.cargas CASCADE;
TRUNCATE public.carga_items CASCADE;

-- Manter: tenants, profiles, auth.users
SELECT 'Dados de teste removidos com sucesso!' as resultado;
