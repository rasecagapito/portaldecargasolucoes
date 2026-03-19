# Scripts de Banco de Dados

## Estrutura
supabase/
├── migrations/          ← Schema versionado por etapa
│   └── schema_v1_sped_funcional.sql
├── scripts/
│   ├── limpar_dados_teste.sql   ← Reseta dados de teste
│   ├── aplicar_producao.md      ← Checklist de deploy PRD
│   └── README.md                ← Este arquivo
└── functions/           ← Edge Functions deployadas

## Fluxo de Ambientes

### Banco de Teste (atual)
- Projeto: kmunvgkwmdonygmldhgf
- Uso: desenvolvimento, testes, validações
- Pode ter dados sujos — use limpar_dados_teste.sql para resetar

### Banco de Produção (futuro)
- Criar novo projeto Supabase quando aprovado
- Aplicar schema limpo via supabase db push
- Nunca testar diretamente em PRD

## Como fazer backup do schema
npx --cache "C:\Temp\npm-cache" supabase db dump \
  --project-ref kmunvgkwmdonygmldhgf \
  --schema-only \
  -f supabase/migrations/schema_vX_descricao.sql

## Convenção de nomes para dumps
schema_v1_sped_funcional.sql      → ✅ Fluxo SPED end-to-end aprovado
schema_v2_cnae_county.sql         → Após resolver CNAE e County
schema_v3_historico_unificado.sql → Após unificar histórico
schema_v4_pre_producao.sql        → Antes de ir para PRD

## Como limpar dados de teste
Execute no SQL Editor do Supabase:
→ supabase/scripts/limpar_dados_teste.sql

## Como ir para produção
Siga o checklist em:
→ supabase/scripts/aplicar_producao.md
