

# Modulo de Cargas com Integracao n8n

## Visao Geral

Transformar o modulo de Cargas (atualmente com dados mock/hardcoded) em um sistema funcional com:
- Cadastro de cargas pelo admin (CRUD no banco)
- Disparo de execucoes via Edge Function para webhooks n8n
- Callback do n8n atualizando status em tempo real
- Historico de execucoes persistido no banco

## Arquitetura do Fluxo

```text
+------------------+       +--------------------+       +-------------+
|   Frontend       | ----> | Edge Function      | ----> |   n8n       |
|   (Disparar)     |       | dispatch-carga     |       |  Webhook    |
+------------------+       +--------------------+       +------+------+
                                    |                          |
                                    v                          |
                           +----------------+                  |
                           |  Supabase DB   | <----------------+
                           | carga_executions|   Edge Function
                           +----------------+   carga-callback
```

## Etapa 1 — Tabelas no Banco de Dados

### Tabela `cargas` (definicoes de workflows)

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | Identificador |
| tenant_id | uuid FK | Isolamento multi-tenant |
| name | text | Nome da carga (ex: "Parceiro de Negocio") |
| description | text | Descricao |
| webhook_url | text | URL do webhook n8n |
| active | boolean | Se a carga esta ativa |
| created_at | timestamptz | Data criacao |
| updated_at | timestamptz | Data atualizacao |

### Tabela `carga_executions` (historico de execucoes)

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | Identificador |
| tenant_id | uuid FK | Isolamento multi-tenant |
| carga_id | uuid FK | Referencia a carga |
| status | text | pending, running, success, error |
| user_id | uuid | Quem disparou |
| params | jsonb | Parametros enviados |
| result | jsonb | Resultado retornado pelo n8n |
| error_message | text | Mensagem de erro (se houver) |
| started_at | timestamptz | Inicio |
| finished_at | timestamptz | Fim |
| created_at | timestamptz | Data criacao |

### RLS Policies
- Usuarios podem visualizar cargas e execucoes do seu tenant
- Apenas admin pode criar/editar/deletar cargas
- Operators e admins podem criar execucoes (disparar cargas)

## Etapa 2 — Edge Functions

### `dispatch-carga`
- Recebe: `carga_id` e `params` (JSON opcional)
- Valida JWT do usuario e permissoes (admin ou operator no modulo cargas)
- Cria registro em `carga_executions` com status `pending`
- Envia POST para o `webhook_url` da carga com payload contendo `tenant_id`, `execution_id` e `params`
- Atualiza status para `running`
- Retorna o `execution_id` ao frontend

### `carga-callback`
- Endpoint publico chamado pelo n8n ao finalizar
- Valida HMAC (hash do segredo compartilhado) no header para garantir autenticidade
- Recebe: `execution_id`, `tenant_id`, `status` (success/error), `result` e `error_message`
- Atualiza o registro em `carga_executions` com status final, resultado e `finished_at`

## Etapa 3 — Secret para HMAC

- Criar um secret `N8N_WEBHOOK_SECRET` no Supabase para validar callbacks
- O mesmo segredo sera configurado no n8n para assinar os callbacks

## Etapa 4 — Frontend (CargasPage)

### Aba Disparo
- Buscar cargas ativas do banco (substituir dados hardcoded)
- Botao "Executar" abre dialog e chama Edge Function `dispatch-carga`
- Feedback de sucesso/erro via toast

### Aba Historico
- Buscar `carga_executions` do banco com join na tabela `cargas`
- Polling a cada 5s para execucoes com status `running` ou `pending`
- Detalhes da execucao no dialog (timeline, resultado, erro)

### CRUD de Cargas (apenas admin)
- Adicionar botao "Nova Carga" para cadastrar webhook_url, nome e descricao
- Opcoes de editar e desativar cargas existentes

## Etapa 5 — Configuracao no n8n (lado do usuario)

O usuario precisara configurar no n8n:
- O workflow recebe o disparo via Webhook node
- Ao final, faz um HTTP Request node de callback para a Edge Function `carga-callback` com o `execution_id`, `status` e `result`, assinado com HMAC usando o segredo compartilhado

## Sequencia de Implementacao

1. Criar migration com as tabelas e RLS policies
2. Criar Edge Function `dispatch-carga`
3. Criar Edge Function `carga-callback`
4. Atualizar `CargasPage` para usar dados reais do banco
5. Adicionar CRUD de cargas para admin
6. Adicionar secret `N8N_WEBHOOK_SECRET`
7. Testar fluxo end-to-end

## Detalhes Tecnicos

- As Edge Functions seguem o padrao existente: `verify_jwt: false` no config.toml com validacao interna via `adminClient.auth.getUser(token)`
- O callback do n8n valida HMAC com `tenant_id` e `execution_id` obrigatorios (conforme padrao de seguranca do projeto)
- Polling no frontend via `react-query` com `refetchInterval` condicional
- Tipos TypeScript serao atualizados automaticamente apos a migration

