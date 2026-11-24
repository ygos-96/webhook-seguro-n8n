# Estudo: Webhook seguro no n8n (academy_001)

Documento para você estudar o projeto inteiro. Tudo aqui usa **dados fictícios**.

## 1. O problema

Quando alguém compra um curso, a plataforma de pagamento chama uma URL sua (o **webhook**) dizendo "pagou". Seu fluxo libera o acesso.

O problema: **essa URL é pública**. Qualquer pessoa que descobrir o endereço pode mandar um POST dizendo "o fulano pagou" e ganhar o curso de graça. Um webhook sem proteção é uma porta aberta.

## 2. O que foi construído

| Peça | O que é | Onde |
| --- | --- | --- |
| Fluxo n8n `academy_001` | Webhook seguro de 8 nós (não publicado) | n8n.tuzinho.app, ID `gGrvXdKwsulPPjhH` |
| `src/verificar.js` | A mesma lógica do fluxo, em JS puro, para poder testar | pasta do projeto |
| `src/receiver.js` | Servidor mínimo que usa a lógica (sem n8n) | pasta do projeto |
| `src/simular.js` | Dispara 7 cenários: 1 legítimo e 6 ataques/falhas | pasta do projeto |
| `test.js` | Sobe o receptor, roda os 7 cenários e confere | `npm test` |

## 3. As 5 defesas (e o ataque que cada uma impede)

1. **Assinatura HMAC-SHA256.** A plataforma e você compartilham um segredo. Ela calcula `HMAC(segredo, dados)` e manda no header `x-signature`. Você recalcula e compara. Sem o segredo, ninguém forja uma assinatura válida. *Impede: pedido falso.*
2. **Comparação em tempo constante** (`crypto.timingSafeEqual`). Comparar com `===` para no primeiro caractere diferente, e a diferença de tempo pode vazar a assinatura certa aos poucos. *Impede: timing attack.*
3. **Janela de 5 minutos no timestamp.** O timestamp entra na assinatura. Se alguém capturar uma requisição válida e reenviar depois, o timestamp já está velho. *Impede: replay.*
4. **Idempotência por `event_id`.** Plataformas reenviam webhooks quando acham que falharam. Guardamos os IDs já vistos (24h) e respondemos 200 sem liberar de novo. *Impede: liberação duplicada.*
5. **Validação de entrada.** Campos obrigatórios, formato de e-mail e produto dentro de uma lista permitida. *Impede: payload malformado e produto inventado.*

Extras: o segredo vem da variável de ambiente `ACADEMY_001_SECRET` (nunca escrito no fluxo) e o receptor limita o tamanho do corpo a 10 KB.

## 4. Como o fluxo n8n funciona

```
Receber webhook ──► Validar (Code) ──► Requisição válida? ──sim──► Evento duplicado? ──sim──► Responder 200
                                              │                          └──não──► Liberar acesso (simulado) ──► Responder 200
                                              └──não──► Responder erro (400/401)
```

- **Receber webhook**: POST em `/webhook/academy_001`, resposta controlada por nós "Respond to Webhook" (`responseMode: responseNode`).
- **Validar**: um nó Code faz as 5 defesas e devolve `{ok, status, reason}`.
- **Responder erro**: usa `status` do item como código HTTP (400 ou 401).
- **Duplicado responde 200 de propósito**: se respondesse erro, a plataforma continuaria reenviando.

## 5. Decisões e limites (importante para entrevista)

- **A assinatura cobre campos escolhidos** (`timestamp.event_id.email.product`), não o corpo cru. Em produção o ideal é assinar o **corpo cru** (no n8n: opção *Raw Body* do webhook), porque assim nenhum campo pode ser alterado sem quebrar a assinatura. Usei campos para o exemplo ficar simples e robusto; cada plataforma real (Hotmart, Kiwify, Stripe) tem o seu formato, e o certo é seguir a documentação dela.
- **Idempotência no n8n usa `$getWorkflowStaticData`**, que só persiste em execuções de produção (fluxo publicado). Em teste manual ela não grava. Em escala maior, o certo é um banco (Redis ou tabela com `event_id` único).
- **Segredo padrão de demonstração.** O Code tenta ler `$env.ACADEMY_001_SECRET` e, se não existir ou o acesso estiver bloqueado, cai num segredo de demonstração. Em produção, **remova esse fallback** para o fluxo falhar fechado.
- **O fluxo está despublicado.** Só publique depois de definir o segredo real. O webhook de produção exposto com segredo de demonstração seria uma falha.
- **A etapa "Liberar acesso" é simulada** (só marca `acesso_liberado: true`). Na vida real ali entra a chamada à plataforma do curso.

## 6. O que foi testado e o resultado

**Teste local (`npm test`): 7 de 7 passaram.**

| # | Cenário | Esperado | Resultado |
| --- | --- | --- | --- |
| 1 | Evento legítimo | 200 | OK |
| 2 | Mesmo evento reenviado | 200 (sem liberar de novo) | OK |
| 3 | Assinatura forjada | 401 | OK |
| 4 | Sem assinatura | 401 | OK |
| 5 | Replay (1h atrás, assinatura correta) | 401 | OK |
| 6 | Dados adulterados após assinar | 401 | OK |
| 7 | Produto fora da lista | 400 | OK |

**Teste no n8n (execuções 1043240 e 1043241, com dados fixados):**
- Assinatura válida: passou pelo nó de validação, "Liberar acesso" rodou, resposta 200.
- Assinatura forjada: resposta 401 "assinatura invalida", sem liberar nada.

**Não testado:** os cenários 2 a 7 diretamente no n8n e uma chamada HTTP real ao endpoint (o fluxo não está publicado). O código do nó é o mesmo de `verificar.js`, que passou nos 7.

## 7. Como rodar

```powershell
cd C:\Users\telwa\Desktop\Meus\webhook-seguro-n8n
npm test                      # 7 cenários contra o receptor local
npm run receptor              # sobe em http://localhost:3001/webhook/academy_001
node src/simular.js http://localhost:3001/webhook/academy_001
```

Para testar o n8n de verdade: defina `ACADEMY_001_SECRET` no servidor, publique o fluxo e rode `node src/simular.js https://n8n.tuzinho.app/webhook/academy_001 <segredo>`.

## 8. Glossário

- **Webhook**: o sistema A chama uma URL do sistema B quando algo acontece.
- **HMAC**: assinatura feita com hash + segredo compartilhado.
- **Replay**: reenviar uma requisição legítima capturada.
- **Idempotência**: repetir a mesma operação não muda o resultado além da primeira vez.
- **Timing attack**: descobrir um segredo medindo o tempo de resposta.
- **Falhar fechado**: na dúvida ou erro, negar.

## 9. Perguntas de entrevista que esse projeto responde

1. Como você protege um endpoint público que recebe notificação de pagamento?
2. Por que não comparar assinatura com `==`?
3. O que é um ataque de replay e como mitigar?
4. Por que responder 200 para evento duplicado?
5. Onde guardar o segredo e por que não no fluxo?

## 10. Próximos passos

- Assinar o corpo cru e testar com o formato real de uma plataforma.
- Trocar a idempotência por banco.
- Remover o segredo de fallback.
- Adicionar rate limit e alerta (Telegram) quando houver muitos 401 seguidos.
- Print do fluxo no n8n para o portfólio (esconda IDs e URLs reais).
