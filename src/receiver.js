'use strict';
// Receptor de referência (sem dependências). Serve para testar a lógica sem n8n.
const http = require('http');
const { verificar } = require('./verificar');

function criarServidor({ segredo }) {
  const vistos = new Map();
  return http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/webhook/academy_001') {
      res.writeHead(404).end();
      return;
    }
    let corpo = '';
    req.on('data', (c) => {
      corpo += c;
      if (corpo.length > 10_000) req.destroy(); // limite de tamanho do payload
    });
    req.on('end', () => {
      let body;
      try { body = JSON.parse(corpo); } catch { body = null; }
      const r = body
        ? verificar({ headers: req.headers, body }, { segredo, vistos })
        : { ok: false, status: 400, motivo: 'json invalido' };
      res.writeHead(r.status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(r));
    });
  });
}

if (require.main === module) {
  const segredo = process.env.ACADEMY_001_SECRET || 'segredo-de-demonstracao-trocar';
  criarServidor({ segredo }).listen(3001, () => console.log('receptor em http://localhost:3001/webhook/academy_001'));
}

module.exports = { criarServidor };
