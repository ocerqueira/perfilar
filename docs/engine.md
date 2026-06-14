# Engine — Fórmulas e cálculos

Toda a física fica em `src/lib/engine.js`. A função central é `compute(rows, P, conv, bdMode)`.

## Parâmetros de entrada (`P`)

| Param | Descrição |
|-------|-----------|
| `t` | Espessura da chapa (mm) |
| `dens` | Densidade do material (kg/m³) — padrão 7850 |
| `C` | Comprimento de corte da peça (mm) |
| `Q` | Quantidade de peças |
| `R` | Raio interno de dobra (mm) |
| `K` | Fator K (posição da linha neutra) — padrão 0,44 |
| `forma` | `'bobina'` ou `'chapa'` |
| `coil` | Largura da bobina (mm) |
| `chapaL` / `chapaC` | Largura × comprimento da chapa (mm) |
| `refilo` | Sobra lateral descartada (mm) |
| `espac` | Espaçamento entre faixas (mm) |
| `cobrarSobra` | Rateio da sobra de MP no preço |
| `mg` | Margem de venda (%) |
| `precoKg` / `precoPc` | Preço de custo por kg ou por peça |

## Blank (desenvolvimento)

O desenvolvimento `des` é a largura total de chapa plana antes das dobras.

```
des = Σ abas - Σ deduções de dobra
```

**Dedução automática** (`bdMode = 'auto'`):

```
BA  = ângulo_rad × (R + K × t)          // bend allowance
SB  = (R + t) × tan(ângulo_rad / 2)     // setback (conv 'ext')
     ou R × tan(…)                       // setback (conv 'int')
deduçãoᵢ = 2 × SB - BA
```

**Dedução manual** (`bdMode = 'man'`):

```
deduçãoᵢ = manBD × (ânguloᵢ / 90)
```

## Peso líquido

```js
kgm    = (des × t × dens) / 1e6     // kg/m (des e t em mm, dens em kg/m³)
pcLiq  = kgm × (C / 1000)           // kg por peça
totLiq = pcLiq × Q                  // kg total
```

## Aproveitamento da matéria-prima

### Bobina

```
coilUtil = coil - 2 × refilo
tiras    = floor((coilUtil + espac) / (des + espac))
sobra    = coilUtil - tiras × des - max(0, tiras-1) × espac
apr      = (tiras × des) / coil × 100   // %
```

Se `cobrarSobra = true`, a largura faturada é rateada:

```
larguraFat = coil / tiras
```

### Chapa

Testa as duas orientações e escolhe a que cabe mais peças:

```
Orientação reta:    cols1 = floor((lUtil + espac) / (des + espac))
                    rows1 = floor((cUtil + espac) / (C   + espac))

Orientação girada:  cols2 = floor((lUtil + espac) / (C   + espac))
                    rows2 = floor((cUtil + espac) / (des + espac))

perSheet = max(cols1×rows1, cols2×rows2)
apr      = (perSheet × des × C) / (chapaL × chapaC) × 100
```

Se `cobrarSobra = true`, a área da chapa é rateada por peça:

```
larguraFat = (chapaL × chapaC / perSheet) / C
```

## Peso faturado

```
kgmFat = (larguraFat × t × dens) / 1e6
pcFat  = kgmFat × (C / 1000)
totFat = pcFat × Q
```

O campo `C.tot` retornado é `totLiq` ou `totFat` conforme `cobrarSobra`.

## Preço

`src/lib/pricing.js` armazena a tabela por **região × material × revestimento**.  
Cada entrada tem `custo` (R$/kg), `venda` (R$/kg) e `concorrente` (R$/kg).

O cálculo de preço total no orçamento (`Docs.svelte`) usa markup simples:

```
custoTotal = C.tot × custo_kg
precoTotal = custoTotal × (1 + mg / 100)
```

> **Atenção:** existe plano de migrar para fórmula "por dentro" (impostos embutidos no PV) na Fatia 4. Isso vai subir o PV sugerido — alinhar com o usuário antes de implantar. Ver [Roadmap](./roadmap).

## Comissão

`src/lib/commission.js` calcula a comissão do vendedor com regra configurável.  
A regra é um objeto com faixas e percentuais — ver `DEFAULT_RULE` no arquivo.

```js
commissionForItem(item, rule)   // comissão de um item
commissionForOrder(items, rule) // comissão total do pedido
```

## Plano de corte

`src/lib/cutplan.js` faz o shell-packing para chapas:

- Agrupa peças por comprimento (`C`) e desenvolvimento (`des`)
- Ordena chapas por aproveitamento descendente
- Distribui as peças em prateleiras (shelf-packing) dentro de cada chapa
- Retorna `{ shelves, placements, hCuts, vCuts, wastes, bottomY, bottomH }` por chapa
