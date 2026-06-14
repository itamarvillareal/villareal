import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: '127.0.0.1',
  port: 3307,
  user: 'root',
  password: 'root',
  database: 'vilareal',
});

function show(title, rows) {
  console.log(`\n===== ${title} =====`);
  console.table(rows);
}

const [q1] = await conn.query(
  `SELECT data_lancamento, descricao, valor, natureza, processo_id, cliente_id
   FROM financeiro_lancamento
   WHERE cliente_id = 938 AND processo_id = 16042
   ORDER BY data_lancamento DESC LIMIT 50`,
);
show('1) par exato cliente 938 + processo 16042', q1);

const [q2] = await conn.query(
  `SELECT processo_id, COUNT(*) qtd, MIN(data_lancamento) min_dt, MAX(data_lancamento) max_dt
   FROM financeiro_lancamento WHERE cliente_id = 938
   GROUP BY processo_id ORDER BY qtd DESC`,
);
show('2) cliente 938 por processo', q2);

const [q3] = await conn.query(
  `SELECT data_lancamento, descricao, valor, natureza, processo_id, cliente_id
   FROM financeiro_lancamento
   WHERE descricao LIKE '%ADELAIDE%' OR (valor BETWEEN 25 AND 27)
   ORDER BY data_lancamento DESC LIMIT 30`,
);
show('3) ADELAIDE ou ~R$26', q3);

// Extra: contexto do contrato/imovel 43 e processo do contrato
const [q4] = await conn.query(
  `SELECT cl.id contrato_id, cl.imovel_id, cl.cliente_id, cl.processo_id,
          cl.valor_aluguel, cl.taxa_administracao_percent
   FROM contrato_locacao cl
   WHERE cl.imovel_id = 43`,
);
show('extra) contrato_locacao do imovel 43', q4);

await conn.end();
