'use strict';
// Dispara 7 cenários (1 legítimo + 6 ataques/falhas) contra uma URL de webhook.
// Uso: node src/simular.js <url> [segredo]
const { assinar } = require('./verificar');

async function simular(url, segredo) {
  const agora = Math.floor(Date.now() / 1000);
  const base = { event_id: 'evt_' + agora, email: 'aluno@exemplo.com', product: 'curso-demo-001', timestamp: String(agora) };
  const enviar = async (body, assinatura) => {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-signature': assinatura ?? assinar(body, segredo) },
      body: JSON.stringify(body),
    });
    return r.status;
  };

  const cenarios = [
    ['1. legítimo', 200, () => enviar(base)],
    ['2. reenvio do mesmo evento (idempotência)', 200, () => enviar(base)],
    ['3. assinatura forjada', 401, () => enviar({ ...base, event_id: base.event_id + 'b' }, 'f'.repeat(64))],
    ['4. sem assinatura', 401, () => enviar({ ...base, event_id: base.event_id + 'c' }, '')],
    ['5. replay (timestamp de 1h atrás, assinado certo)', 401, () => {
      const velho = { ...base, event_id: base.event_id + 'd', timestamp: String(agora - 3600) };
      return enviar(velho);
    }],
    ['6. adulterado (troca o produto depois de assinar)', 401, () => {
      const b = { ...base, event_id: base.event_id + 'e' };
      return enviar({ ...b, product: 'curso-demo-002' }, assinar(b, segredo));
    }],
    ['7. produto fora da lista', 400, () => enviar({ ...base, event_id: base.event_id + 'f', product: 'curso-premium-hack' })],
  ];

  let falhas = 0;
  for (const [nome, esperado, fn] of cenarios) {
    const status = await fn();
    const ok = status === esperado;
    if (!ok) falhas++;
    console.log(`${ok ? 'OK  ' : 'FALHA'}  esperado ${esperado}  recebeu ${status}  ${nome}`);
  }
  console.log(falhas === 0 ? '\nTodos os cenários passaram.' : `\n${falhas} cenário(s) falharam.`);
  return falhas;
}

if (require.main === module) {
  const [url, segredo = 'segredo-de-demonstracao-trocar'] = process.argv.slice(2);
  if (!url) { console.error('uso: node src/simular.js <url> [segredo]'); process.exit(2); }
  simular(url, segredo).then((f) => { process.exitCode = f ? 1 : 0; });
}

module.exports = { simular };
