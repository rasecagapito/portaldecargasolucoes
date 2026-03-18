# Walkthrough: Ajuste Cirurgico do COUNTY no Fluxo SPED

## Objetivo

Aplicar apenas os ajustes necessarios para corrigir o preenchimento do municipio no SAP Business One, sem alterar a estrutura funcional do workflow.

O fluxo atual ja esta funcional. O ajuste sera limitado a 2 nos:

1. `SAP  Get COUNTY ID`
2. `SAP  Map COUNTY`

## Diagnostico

O fluxo atual ja monta `BPAddresses` corretamente no node `HTTP  Create BP`.

O problema esta apenas na conversao do codigo IBGE do municipio para o codigo interno do SAP que deve ser enviado no campo `County`.

A query validada no Semantic Layer retorna exatamente os campos necessarios:

- `codigo_Interno_SAP`
- `codigo_municipio_ibge`

Por isso, a estrategia correta e reaproveitar a query ja validada e apenas redirecionar o node de busca de municipio para ela.

## Alteracao Planejada

### No 1: `SAP  Get COUNTY ID`

Substituir a URL atual baseada em `/b1s/v2/Counties` pela query do Semantic Layer.

Configurar:

- Metodo: `GET`
- URL:

```text
={{ $('SL  Config').first().json.sap_url }}/b1s/v2/sml.svc/OCNT%20-%20LIST?$filter=codigo_municipio_ibge eq '{{ $('Split Out').item.json.BPAddresses[0].County }}'
```

### No 2: `SAP  Map COUNTY`

Atualizar apenas o valor da variavel `county_id` para capturar a coluna retornada pela query validada.

Configurar:

- Campo: `county_id`
- Expressao:

```text
={{ $json.value[0].codigo_Interno_SAP || "" }}
```

## Fluxo Resultante

1. `Split Out` gera `BPAddresses[0].County` com o codigo IBGE.
2. `SAP  Get COUNTY ID` consulta a query `OCNT - LIST` no Semantic Layer.
3. `SAP  Map COUNTY` extrai `codigo_Interno_SAP`.
4. `HTTP  Create BP` continua usando a logica ja existente:

```text
{{ $('SAP  Map COUNTY').first().json.county_id || $('Split Out').item.json.BPAddresses[0].County }}
```

5. Se houver retorno da query, o SAP recebe o codigo interno correto no `County`.
6. Se nao houver retorno, o fluxo preserva o valor original como fallback.

## Escopo Deliberadamente Nao Alterado

Nao alterar:

- `Split Out`
- `HTTP  Create BP`
- logica de `CRD7`
- login SAP
- callback Supabase
- fluxo de CNAE

## Resultado Esperado

Ao criar o Business Partner:

- `BPAddresses[].County` deixa de receber o IBGE bruto
- passa a receber o codigo interno do SAP
- o endereco CRD1 fica compativel com o SAP B1 sem refatorar o fluxo inteiro

## Validacao Recomendada

1. Executar o webhook com um participante cujo municipio exista na `OCNT - LIST`
2. Conferir se `SAP  Get COUNTY ID` retorna `codigo_Interno_SAP`
3. Conferir se `SAP  Map COUNTY` popula `county_id`
4. Conferir no `HTTP  Create BP` se `County` vai com o valor interno SAP
5. Validar no SAP se o cadastro entrou com o municipio correto
