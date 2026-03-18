# Task: Ajuste do COUNTY no Fluxo SPED

## Contexto

Esta tarefa trata apenas do ajuste do municipio (`County`) no payload de `BPAddresses` enviado ao SAP.

O fluxo esta funcional e nao deve sofrer refatoracoes desnecessarias.

## Meta

Corrigir o mapeamento:

- origem: codigo IBGE vindo de `Split Out`
- destino: codigo interno SAP via query `OCNT - LIST`

## Escopo

Alterar somente estes 2 nos:

- `SAP  Get COUNTY ID`
- `SAP  Map COUNTY`

## Checklist

- [ ] Confirmar URL final do node `SAP  Get COUNTY ID`
- [ ] Confirmar expressao final do campo `county_id` em `SAP  Map COUNTY`
- [ ] Salvar workflow sem tocar em outros nos
- [ ] Executar teste com municipio conhecido
- [ ] Validar retorno da query `OCNT - LIST`
- [ ] Validar `county_id` preenchido
- [ ] Validar `HTTP  Create BP` usando o valor convertido
- [ ] Confirmar cadastro correto no SAP

## Configuracao Alvo

### `SAP  Get COUNTY ID`

```text
={{ $('SL  Config').first().json.sap_url }}/b1s/v2/sml.svc/OCNT%20-%20LIST?$filter=codigo_municipio_ibge eq '{{ $('Split Out').item.json.BPAddresses[0].County }}'
```

### `SAP  Map COUNTY`

```text
={{ $json.value[0].codigo_Interno_SAP || "" }}
```

## Criterio de Sucesso

O fluxo continua funcional e o campo `County` em `BPAddresses` passa a ser enviado com o codigo interno correto do SAP.

## Riscos

- A query `OCNT - LIST` pode nao retornar linha para algum IBGE
- O node `Split Out` precisa continuar entregando `BPAddresses[0].County`
- O N8N nao permitira salvar se existir outro node com erro de validacao fora deste ajuste

## Observacao Operacional

Se o N8N bloquear o salvamento novamente, revisar primeiro qualquer node com erro de validacao visual, especialmente `Split Out`, antes de concluir que o problema esta nos ajustes do COUNTY.
