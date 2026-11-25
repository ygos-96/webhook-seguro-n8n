# Webhook seguro para n8n

Receptor de webhook de pagamento com **assinatura HMAC-SHA256, proteção contra replay, idempotência e validação de entrada**. Inclui fluxo n8n, receptor de referência em Node.js (sem dependências) e um simulador de 7 cenários (1 legítimo, 6 ataques). Todos os dados são fictícios.

## Por que existe

Um webhook que libera acesso a um curso é uma URL pública. Sem proteção, qualquer pessoa pode fingir que pagou.

## Defesas

| Defesa | Ataque que impede |
| --- | --- |
| HMAC-SHA256 com segredo compartilhado | Pedido forjado |
| `timingSafeEqual` | Timing attack |
| Janela de 5 min no timestamp | Replay |
| Idempotência por `event_id` | Liberação duplicada |
| Validação de campos, e-mail e produto | Payload malformado |

## Rodar

```bash
npm test                 # sobe o receptor e roda os 7 cenários
npm run receptor         # http://localhost:3001/webhook/academy_001
```

Requer Node 18+. Sem `npm install`.

## Estrutura

```
src/verificar.js   lógica de validação (a mesma do nó Code do n8n)
src/receiver.js    servidor de referência
src/simular.js     7 cenários de teste/ataque
test.js            executa tudo e confere os resultados
academy_001.json   fluxo n8n para importar (Workflows > Import from file)
```

Para usar o fluxo no n8n: importe `academy_001.json` e defina a variável de ambiente `ACADEMY_001_SECRET`. Sem ela o fluxo usa um segredo de demonstração público, então não publique com dados reais.

Veja `ESTUDO.md` para o raciocínio completo e as limitações conhecidas.
