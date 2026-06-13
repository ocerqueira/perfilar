# ADR 001: Modelagem de ferramental de dobradeira (punção + matriz)

**Data:** 2026-06-13
**Status:** Proposto

## Contexto

O sistema calcula desenvolvimento de perfis dobrados e já aplica restrições de aba mínima, raio mínimo e auto-interseção. O próximo passo é incorporar o ferramental real da dobradeira (punção + matriz) como fonte de restrições, substituindo ou complementando as restrições do catálogo de preset. Sem essa camada, o usuário pode calcular um perfil válido no papel mas impossível de dobrar com as ferramentas disponíveis.

## Decisão

Modelar Máquina, Punção e Matriz como entidades de catálogo persistidas em localStorage, com seleção global por sessão (não por dobra individual). As restrições derivadas do ferramental alimentam o mesmo mecanismo de `validateProfile` já existente, como uma terceira fonte de restrições (mais restritiva prevalece sobre catálogo).

## Alternativas consideradas

- **Por dobra individual:** permite tooling diferente em cada dobra do mesmo perfil. Muito mais próximo da realidade de setup complexo, mas aumenta a complexidade de UX dramaticamente para um dev solo. Deixar para v2.
- **Global por sessão (escolhida):** uma combinação punção+matriz ativa por vez. Simples de implementar, cobre 90% dos casos reais (setup único por lote de produção).
- **Sem entidade Máquina, só ferramentas avulsas:** economiza uma camada, mas perde a relação "quais ferramentas essa máquina tem disponíveis" que é a forma real de trabalho de uma serralheria.

## Consequências

- Positivas: restrições ficam ancoradas em física real, não em regras de thumb do catálogo
- Negativas / trade-offs aceitos: setup por dobra (bocais de punção diferentes por ângulo) fica fora do v1
- Riscos a monitorar: usuário pode não cadastrar ferramental e ficar sem restrição — fallback para DEFAULT_RESTRICTIONS deve continuar funcionando
