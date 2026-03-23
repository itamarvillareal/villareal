const CONDOMINIOS = [
  'Veredas do Bosque',
  'Parque das Palmeiras',
  'Jardim das Aroeiras',
  'Condomínio Vila Verde',
  'Residencial Horizonte',
  'Condomínio Serra Azul',
  'Residencial Lago Azul',
  'Vila das Acácias',
];

const GARANTIAS = ['Fiador', 'Caução', 'Seguro Fiança', 'Depósito'];

function pad2(n) {
  return String(n).padStart(2, '0');
}

function pad3(n) {
  return String(n).padStart(3, '0');
}

function padN(n, size) {
  return String(n).padStart(size, '0');
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function formatCpfFromBase(baseDigits) {
  const digits = String(baseDigits).replace(/\D/g, '').padStart(11, '0').slice(0, 11);
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

function formatPhoneFromDigits(digits) {
  const d = String(digits).replace(/\D/g, '').padStart(11, '0').slice(0, 11);
  const ddd = d.slice(0, 2);
  const part1 = d.slice(2, 7);
  const part2 = d.slice(7, 11);
  return `${ddd} ${part1}-${part2}`;
}

function dataBr(offsetDays, yearBase) {
  const d = new Date(yearBase, 0, 1);
  d.setDate(d.getDate() + offsetDays);
  const dd = pad2(d.getDate());
  const mm = pad2(d.getMonth() + 1);
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function enderecoMock(id) {
  const ruaN = (id % 30) + 1;
  const quadra = pad2((id * 3) % 20);
  const lote = pad2((id * 7) % 40);
  const apt = pad4(1000 + id * 11);
  const bloco = ['A', 'B', 'C', 'D', 'E'][(id % 5 + 5) % 5];
  return `Rua L-${ruaN}, Quadra ${quadra}, Lote ${lote}, Apartamento ${apt}, Bloco ${bloco}, Residencial ${CONDOMINIOS[id % CONDOMINIOS.length]}`;
}

function pad4(n) {
  return String(n).padStart(4, '0');
}

function codigoProcMock(id) {
  // Gera valores “plausíveis” para a tela (ex.: screenshot: código 938 / proc 42).
  const codigo = String(900 + id); // 901..945
  const proc = clamp(20 + (id % 30), 1, 999); // ~20..49
  return { codigo, proc };
}

export function getImovelMock(imovelId) {
  const id = Number(imovelId);
  if (!Number.isFinite(id) || id < 1 || id > 45) return null;

  const condominio = CONDOMINIOS[id % CONDOMINIOS.length];
  const { codigo, proc } = codigoProcMock(id);

  const ocupado = id % 2 === 1;
  const garagens = String(1 + (id % 3));

  const diaPag = pad2(1 + (id % 25));
  const garantia = GARANTIAS[id % GARANTIAS.length];
  const valorGarantia = String(1000 + id * 250);
  const valorLocacao = String(1200 + id * 37);

  const diaVenc = pad2(5 + (id % 25));
  const anoBase = 2025 + (id % 2);

  const aguaNumero = `${7000000 + id * 19}-${(id % 9) + 1}`;
  const energiaNumero = String(10000000000 + id * 12345).slice(0, 11);
  const gasNumero = `1091705 - ${pad2(10 + (id % 50))}`.replace(/\s+/, ' ');

  /** Número da pessoa no cadastro (exibido no imóvel; alinhado ao sufixo do nome mock). */
  const proprietarioNumeroPessoa = String(100 + id);
  const inquilinoNumeroPessoa = String(200 + id);

  const proprietario = `PROPRIETÁRIO ${pad3(100 + id)} — VILA REAL`;
  const inquilino = `INQUILINO ${pad3(200 + id)} — VILA REAL`;

  const proprietarioCpf = formatCpfFromBase(30000000000 + id * 777);
  const inquilinoCpf = formatCpfFromBase(60000000000 + id * 555);

  const proprietarioContato = formatPhoneFromDigits(60000000000 + id * 17);
  const inquilinoContato = formatPhoneFromDigits(61000000000 + id * 19);

  const banco = ['Itaú', 'Bradesco', 'Banco do Brasil', 'Caixa Econômica'][id % 4];
  const agencia = padN(1000 + (id * 37) % 9000, 4);
  const numeroBanco = padN(1 + (id % 12), 4);
  const conta = padN(100000 + (id * 91) % 899999, 6);

  const cpfBanco = formatCpfFromBase(70000000000 + id * 333);
  const titular = `TITULAR ${pad3(900 + id)}`;
  const chavePix = `pix-${padN(100000 + (id * 71) % 999999, 6)}`;

  return {
    imovelOcupado: ocupado,
    codigo,
    proc,
    observacoesInquilino: ocupado
      ? `Imóvel ocupado. Observação ${id}.`
      : `Imóvel desocupado. Observação ${id}.`,
    endereco: enderecoMock(id),
    condominio: condominio,
    unidade: `Unidade ${1100 + id} C`,
    garagens,
    garantia,
    valorGarantia,
    valorLocacao,
    diaPagAluguel: diaPag,
    dataPag1TxCond: '',
    inscricaoImobiliaria: `${pad3(101 + (id % 899))}.${pad3(406 + (id % 899))}.${pad2(33 + (id % 66))}243`,
    existeDebIptu: id % 3 === 0 ? 'NÃO' : 'SIM',
    dataConsIptu: dataBr(150 + id * 3, anoBase),
    aguaNumero,
    dataConsAgua: dataBr(100 + id * 2, anoBase),
    existeDebAgua: id % 4 === 0 ? 'SIM' : 'NÃO',
    diaVencAgua: diaVenc,
    energiaNumero,
    dataConsEnergia: dataBr(120 + id * 2, anoBase),
    existeDebEnergia: id % 4 === 1 ? 'SIM' : 'NÃO',
    diaVencEnergia: pad2(3 + (id % 27)),
    gasNumero,
    dataConsGas: dataBr(130 + id * 2, anoBase),
    existeDebGas: id % 5 === 0 ? 'SIM' : 'NÃO',
    diaVencGas: pad2(2 + (id % 28)),
    dataInicioContrato: dataBr(20 + id, 2026),
    dataFimContrato: dataBr(200 + id, 2026),
    dataConsDebitoCond: dataBr(80 + id * 2, anoBase),
    existeDebitoCond: id % 2 === 0 ? 'NÃO' : 'SIM',
    diaRepasse: pad2(10 + (id % 20)),
    banco,
    agencia,
    numeroBanco,
    conta,
    cpfBanco,
    titular,
    chavePix,
    proprietarioNumeroPessoa,
    inquilinoNumeroPessoa,
    proprietario,
    proprietarioCpf,
    proprietarioContato,
    linkVistoria: 'https://www.dropbox.com/',
    inquilino,
    inquilinoCpf,
    inquilinoContato,
  };
}

export function getImoveisMockTotal() {
  return 45;
}

