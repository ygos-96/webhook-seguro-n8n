'use strict';
const { criarServidor } = require('./src/receiver');
const { simular } = require('./src/simular');

const segredo = 'segredo-de-teste';
const srv = criarServidor({ segredo }).listen(0, async () => {
  const { port } = srv.address();
  const falhas = await simular(`http://localhost:${port}/webhook/academy_001`, segredo);
  process.exitCode = falhas ? 1 : 0;
  srv.closeAllConnections();
  srv.close();
});
