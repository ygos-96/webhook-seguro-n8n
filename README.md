# Webhook seguro para n8n

[![ci](https://github.com/ygos-96/webhook-seguro-n8n/actions/workflows/ci.yml/badge.svg)](https://github.com/ygos-96/webhook-seguro-n8n/actions/workflows/ci.yml)

Receptor de webhook de pagamento com **assinatura HMAC-SHA256, proteção contra replay, idempotência e validação de entrada**. O repositório traz o fluxo para importar no n8n, um receptor de referência em Node.js (sem dependências) e um simulador de 7 cenários: 1 legítimo e 6 ataques ou falhas. Todos os dados são fictícios.

## Por que existe

Quando alguém compra um curso, a plataforma de pagamento chama uma URL sua (o webhook) avisando "pagou", e o seu fluxo libera o acesso. Essa URL é pública: sem proteção, qualquer pessoa que descubra o endereço pode enviar um POST dizendo que pagou e ganhar o curso de graça. Este projeto mostra como fechar essa porta.

## Defesas

| Defesa | Como funciona | Ataque que impede |
| --- | --- | --- |
| Assinatura HMAC-SHA256 | A plataforma e o receptor compartilham um segredo. O receptor recalcula a assinatura e compara | Pedido forjado |
| Comparação em tempo constante (`timingSafeEqual`) | Evita que o tempo de resposta revele a assinatura correta aos poucos | Timing attack |
| Janela de 5 minutos no timestamp | O timestamp entra na assinatura, então uma requisição capturada perde a validade | Replay |
| Idempotência por `event_id` | Guarda os eventos já vistos por 24 h e responde 200 sem liberar de novo | Liberação duplicada |
| Validação de entrada | Campos obrigatórios, formato de e-mail e produto dentro de uma lista permitida | Payload malformado e produto inventado |

Também: o segredo vem da variável de ambiente `ACADEMY_001_SECRET` (nunca escrito no fluxo) e o receptor limita o corpo da requisição a 10 KB.

## Como o fluxo funciona

```
Receber webhook ─► Validar (Code) ─► Requisição válida? ─sim─► Evento duplicado? ─sim─► Responder 200
                                            │                        └─não─► Liberar acesso (simulado) ─► Responder 200
                                            └─não─► Responder erro (400 ou 401)
```

- **Receber webhook:** POST em `/webhook/academy_001`, com a resposta controlada por nós "Respond to Webhook".
- **Validar:** um nó Code aplica as 5 defesas e devolve `{ ok, status, reason }`. É a mesma lógica de `src/verificar.js`.
- **Evento duplicado responde 200 de propósito:** se respondesse erro, a plataforma continuaria reenviando.
- **Liberar acesso** é simulado (marca `acesso_liberado: true`). Na vida real, ali entra a chamada à plataforma do curso.

## Resultado dos testes

`npm test` sobe o receptor, roda os 7 cenários e confere os códigos de resposta. **7 de 7 passam.**

| # | Cenário | Esperado | Resultado |
| --- | --- | --- | --- |
| 1 | Evento legítimo | 200 | OK |
| 2 | Mesmo evento reenviado | 200, sem liberar de novo | OK |
| 3 | Assinatura forjada | 401 | OK |
| 4 | Sem assinatura | 401 | OK |
| 5 | Replay (1 h atrás, assinatura correta) | 401 | OK |
| 6 | Dados adulterados depois de assinar | 401 | OK |
| 7 | Produto fora da lista | 400 | OK |

O fluxo também foi exercitado no n8n com dados fixados: assinatura válida libera o acesso e retorna 200, e assinatura forjada retorna 401 sem liberar nada. Os testes rodam a cada push no GitHub Actions.

## Rodar

```bash
npm test                 # sobe o receptor e roda os 7 cenários
npm run receptor         # http://localhost:3001/webhook/academy_001
```

Requer Node 18 ou superior. Não precisa de `npm install`.

Para usar o fluxo no n8n, importe `academy_001.json` (Workflows > Import from file) e defina `ACADEMY_001_SECRET` no servidor. Sem essa variável, o fluxo cai num segredo de demonstração público, então **não publique com dados reais** antes de defini-la.

## Estrutura

```
src/verificar.js   lógica de validação (a mesma do nó Code do n8n)
src/receiver.js    servidor de referência
src/simular.js     os 7 cenários de teste e ataque
test.js            executa tudo e confere os resultados
academy_001.json   fluxo n8n para importar
ESTUDO.md          raciocínio completo, glossário e perguntas de entrevista
```

## Decisões e limitações conhecidas

- **A assinatura cobre campos escolhidos** (`timestamp.event_id.email.product`), não o corpo cru. Em produção o ideal é assinar o corpo cru, para que nenhum campo possa ser alterado sem invalidar a assinatura.
- **Idempotência em memória.** No n8n ela usa `$getWorkflowStaticData`, que só persiste em execuções de produção. Em escala maior, o certo é um banco (Redis ou uma tabela com `event_id` único).
- **Segredo de demonstração como fallback.** Foi mantido só para o exemplo rodar. Em produção, esse fallback deve ser removido para o fluxo falhar fechado quando o segredo não existir.
- **Não testado:** uma chamada HTTP real ao endpoint publicado no n8n. A lógica do nó é a mesma de `verificar.js`, que passa nos 7 cenários.

## Próximos passos

- Assinar o corpo cru e validar com o formato real de uma plataforma de pagamento.
- Trocar a idempotência por um banco de dados.
- Remover o segredo de fallback.
- Adicionar limite de taxa e alerta quando houver muitos 401 seguidos.

## Licença

MIT. Veja [LICENSE](LICENSE).
