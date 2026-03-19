# Checklist — Deploy em Produção

## Pré-requisitos
- [ ] Todos os testes aprovados no banco de teste
- [ ] Schema dump atualizado no GitHub
- [ ] Credenciais SAP de produção em mãos

## 1. Criar novo projeto Supabase
- Acesse: https://supabase.com/dashboard
- New Project → anote o [NOVO_PROJECT_REF]

## 2. Aplicar schema limpo
npx --cache "C:\Temp\npm-cache" supabase db push \
  --project-ref [NOVO_PROJECT_REF]

## 3. Configurar Secrets
No Dashboard → Project Settings → Edge Functions → Secrets:
- SAP_MASTER_KEY = [valor real]
- N8N_WEBHOOK_SECRET = [valor real]
- N8N_SPED_WEBHOOK_URL = [URL do N8N]

## 4. Deploy das Edge Functions
npx --cache "C:\Temp\npm-cache" supabase functions deploy dispatch-carga-sped --project-ref [NOVO_PROJECT_REF]
npx --cache "C:\Temp\npm-cache" supabase functions deploy carga-callback --project-ref [NOVO_PROJECT_REF]
npx --cache "C:\Temp\npm-cache" supabase functions deploy dispatch-carga --project-ref [NOVO_PROJECT_REF]
npx --cache "C:\Temp\npm-cache" supabase functions deploy cancel-carga --project-ref [NOVO_PROJECT_REF]

## 5. Atualizar .env do portal
VITE_SUPABASE_URL=https://[NOVO_PROJECT_REF].supabase.co
VITE_SUPABASE_ANON_KEY=[NOVA_ANON_KEY]
VITE_SUPABASE_PUBLISHABLE_KEY=[NOVA_ANON_KEY]

## 6. Atualizar N8N
- Supabase Secrets: atualizar N8N_SPED_WEBHOOK_URL
- N8N workflow: verificar callback_url

## 7. Teste de sanidade em PRD
- [ ] Login funciona
- [ ] Cadastrar 1 cliente real
- [ ] Configurar SAP do cliente
- [ ] Upload 1 arquivo SPED real
- [ ] Confirmar BP criado no SAP PRD
- [ ] Confirmar status "success" no banco PRD
