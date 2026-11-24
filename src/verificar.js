'use strict';
// Mesma lógica do nó Code do fluxo n8n "academy_001", isolada para poder testar.
const crypto = require('crypto');

const PRODUTOS = ['curso-demo-001', 'curso-demo-002'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const JANELA_SEGUNDOS = 300; // 5 minutos
const RETENCAO_MS = 24 * 60 * 60 * 1000; // lembra dos event_id por 24h

// String que é assinada. Ordem fixa evita ambiguidade.
function canonica(body) {
  return [body.timestamp, body.event_id, body.email, body.product].join('.');
}

function assinar(body, segredo) {
  return crypto.createHmac('sha256', segredo).update(canonica(body)).digest('hex');
}

function rejeitar(status, motivo) {
  return { ok: false, status, motivo };
}

// `vistos` é um Map(event_id -> timestamp ms). No n8n é o $getWorkflowStaticData.
function verificar({ headers = {}, body = {} }, { segredo, vistos, agora = Date.now() }) {
  for (const campo of ['event_id', 'email', 'product', 'timestamp']) {
    if (body[campo] === undefined || body[campo] === null || body[campo] === '') {
      return rejeitar(400, `payload invalido: falta ${campo}`);
    }
  }
  if (!EMAIL.test(String(body.email))) return rejeitar(400, 'payload invalido: email');
  if (!PRODUTOS.includes(String(body.product))) return rejeitar(400, 'payload invalido: produto desconhecido');

  const recebida = Buffer.from(String(headers['x-signature'] || ''), 'utf8');
  const esperada = Buffer.from(assinar(body, segredo), 'utf8');
  // comprimento diferente => timingSafeEqual lançaria erro, então checa antes
  if (recebida.length !== esperada.length || !crypto.timingSafeEqual(recebida, esperada)) {
    return rejeitar(401, 'assinatura invalida');
  }

  const idade = Math.abs(agora / 1000 - Number(body.timestamp));
  if (!(idade <= JANELA_SEGUNDOS)) return rejeitar(401, 'timestamp fora da janela de 5 minutos (replay)');

  for (const [id, quando] of vistos) if (agora - quando > RETENCAO_MS) vistos.delete(id);
  if (vistos.has(body.event_id)) {
    return { ok: true, status: 200, duplicado: true, event_id: body.event_id };
  }
  vistos.set(body.event_id, agora);
  return { ok: true, status: 200, duplicado: false, event_id: body.event_id, email: body.email, product: body.product };
}

module.exports = { verificar, assinar, canonica, JANELA_SEGUNDOS };
