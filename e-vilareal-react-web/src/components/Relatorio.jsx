import { useState, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/** Gera número CNJ mock determinístico (prioriza dados reais: numeroProcesso / numeroProcessoNovo). */
function gerarNumeroProcessoCnjMock(row, idx) {
  const proc = Number(String(row.proc ?? '').replace(/\D/g, '')) || 1;
  const seq = 5600000 + idx * 137 + proc * 11;
  const dv = String(10 + ((idx + proc) % 90)).padStart(2, '0');
  const foro = String(1000 + ((idx * 13 + proc * 7) % 900)).slice(-4);
  return `${String(seq).slice(0, 7)}-${dv}.2025.8.09.${foro}`;
}

const COLUNAS = [
  { id: 'cliente', label: 'Cliente', minW: '180px' },
  { id: 'numeroProcesso', label: 'N.º Processo', minW: '200px' },
  { id: 'inRequerente', label: 'In Requerente/Recurso', minW: '140px' },
  { id: 'ultimoAndamento', label: 'Último Andamento', minW: '200px' },
  { id: 'dataConsulta', label: 'Data da Consulta', minW: '100px' },
  { id: 'proximaConsulta', label: 'Próxima Consulta', minW: '110px' },
  { id: 'observacaoProcesso', label: 'Observação do Processo', minW: '180px' },
  { id: 'consultor', label: 'Consultor', minW: '100px' },
  { id: 'proc', label: 'Proc.', minW: '56px' },
  { id: 'lmv', label: 'Lmv', minW: '56px' },
  { id: 'fase', label: 'Fase', minW: '140px' },
  { id: 'observacaoFase', label: 'Observação de Fase', minW: '140px' },
  { id: 'descricaoAcao', label: 'Descrição da Ação', minW: '140px' },
  { id: 'prazoFatal', label: 'Prazo Fatal', minW: '90px' },
  { id: 'competencia', label: 'Competência', minW: '180px' },
  { id: 'dataAudiencia', label: 'Data da Audiência', minW: '110px' },
  { id: 'horaAudiencia', label: 'Hora da Audiência', minW: '100px' },
  { id: 'cepReu', label: 'CEP [primeiro réu]', minW: '100px' },
  { id: 'inv', label: 'Inv', minW: '56px' },
  { id: 'consultas', label: 'Consultas', minW: '80px' },
];

const relatorioMock = [
  { cliente: 'DAYANE FURTADO DE OLIVEIRA PRES', inRequerente: '', ultimoAndamento: 'PROCESSO RETORNOU AO PRIMEIRO GRAU', dataConsulta: '21/11/2023', proximaConsulta: '22/12/2023', observacaoProcesso: 'Constituído em KARLA', consultor: 'Karla Almeida', proc: '1', lmv: '27', fase: 'Em Andamento', observacaoFase: 'não precisa resumir, Kkkk', descricaoAcao: 'AÇÃO DE COBRANÇA', prazoFatal: '', competencia: '1ª VARAS CÍVEIS', dataAudiencia: '', horaAudiencia: '', cepReu: '77725000', inv: '27', consultas: '56' },
  { cliente: 'SEZVE TELECOM EIRELI ME', inRequerente: 'REQUERIDO', ultimoAndamento: 'AGUARDANDO ASSINATURA DO ACORDO', dataConsulta: '07/02/2024', proximaConsulta: '08/03/2024', observacaoProcesso: 'Proc. 572 e Proc. 784', consultor: 'ITAMAR', proc: '527', lmv: '', fase: 'Aguardando Peticionamento', observacaoFase: 'entrou em contato via WHATSAPP', descricaoAcao: 'AÇÃO DE COBRANÇA', prazoFatal: '15/04/2024', competencia: '1ª JUIZADO ESPECIAL CÍVEL', dataAudiencia: '', horaAudiencia: '', cepReu: '', inv: '', consultas: '38' },
  { cliente: 'ASPAROL - ASSOCIAÇÃO DOS MORADORES DO FAROL DO L', inRequerente: '', ultimoAndamento: 'TEM RELATÓRIO DE ATENDIMENTOS NA PASTA', dataConsulta: '29/03/2023', proximaConsulta: '28/04/2023', observacaoProcesso: '+ Proc. 522 e Proc. 588', consultor: 'DAAE', proc: '568', lmv: '21', fase: 'Em Andamento', observacaoFase: '', descricaoAcao: 'BUSCA E APREENSÃO', prazoFatal: '', competencia: '1ª VARA DA FAZENDA PÚBLICA ESTADUAL', dataAudiencia: '10/05/2023', horaAudiencia: '14:00', cepReu: '', inv: '18', consultas: '22' },
  { cliente: 'CONDOMINIO PORTAL DOS YPES 3', inRequerente: 'REQUERIDO', ultimoAndamento: 'CITAÇÃO EFETIVADA', dataConsulta: '02/10/2025', proximaConsulta: '02/11/2025', observacaoProcesso: 'ITAMAR NÃO ESTAVA HABILITADO, NÃO CONST', consultor: 'Karla Almeida', proc: '42', lmv: '', fase: 'Em Andamento', observacaoFase: '', descricaoAcao: 'PEDIDO DE DANO MORAL POR CONSTRIÇÃO', prazoFatal: '', competencia: '2º JUIZADO ESPECIAL CÍVEL', dataAudiencia: '', horaAudiencia: '', cepReu: '', inv: '', consultas: '12' },
  { cliente: 'FLAVIA GOMES SANTOS', inRequerente: '', ultimoAndamento: 'CONTESTAÇÃO APRESENTADA', dataConsulta: '15/09/2025', proximaConsulta: '15/10/2025', observacaoProcesso: '', consultor: 'ITAMAR', proc: '125', lmv: '', fase: 'Aguardando Peticionamento', observacaoFase: '', descricaoAcao: 'AÇÃO DE INDENIZAÇÃO', prazoFatal: '20/11/2025', competencia: '1ª JUIZADO ESPECIAL CÍVEL', dataAudiencia: '', horaAudiencia: '', cepReu: '74000000', inv: '', consultas: '8' },
  { cliente: 'JAILIS PEREIRA DOURADO', inRequerente: 'REQUERIDO', ultimoAndamento: 'AUDIÊNCIA DESIGNADA', dataConsulta: '01/08/2025', proximaConsulta: '01/09/2025', observacaoProcesso: 'Proc. 784', consultor: 'Karla Almeida', proc: '89', lmv: '15', fase: 'Em Andamento', observacaoFase: '', descricaoAcao: 'AÇÃO DECLARATÓRIA DE NULIDADE', prazoFatal: '', competencia: '3º JUIZADO ESPECIAL CÍVEL', dataAudiencia: '15/12/2025', horaAudiencia: '09:00', cepReu: '', inv: '12', consultas: '45' },
  { cliente: 'MARIA SILVA COSTA', inRequerente: '', ultimoAndamento: 'SENTENÇA PUBLICADA', dataConsulta: '12/06/2025', proximaConsulta: '12/07/2025', observacaoProcesso: '', consultor: 'ITAMAR', proc: '334', lmv: '', fase: 'Em Andamento', observacaoFase: '', descricaoAcao: 'AÇÃO DE COBRANÇA', prazoFatal: '', competencia: '1ª VARAS CÍVEIS', dataAudiencia: '', horaAudiencia: '', cepReu: '', inv: '', consultas: '31' },
  { cliente: 'JOSÉ OLIVEIRA LIMA', inRequerente: 'REQUERIDO', ultimoAndamento: 'RECURSO INTERPOSTO', dataConsulta: '20/04/2025', proximaConsulta: '20/05/2025', observacaoProcesso: 'Proc. 522', consultor: 'DAAE', proc: '67', lmv: '8', fase: 'Aguardando Peticionamento', observacaoFase: '', descricaoAcao: 'AÇÃO DE DESPEJO', prazoFatal: '10/06/2025', competencia: '2º JUIZADO ESPECIAL CÍVEL', dataAudiencia: '', horaAudiencia: '', cepReu: '72800000', inv: '8', consultas: '19' },
  { cliente: 'ANA PAULA FERREIRA', inRequerente: '', ultimoAndamento: 'CONCILIAÇÃO REALIZADA', dataConsulta: '05/03/2025', proximaConsulta: '05/04/2025', observacaoProcesso: '', consultor: 'Karla Almeida', proc: '201', lmv: '', fase: 'Em Andamento', observacaoFase: 'acordo firmado', descricaoAcao: 'AÇÃO DE INDENIZAÇÃO', prazoFatal: '', competencia: '1ª JUIZADO ESPECIAL CÍVEL', dataAudiencia: '', horaAudiencia: '', cepReu: '', inv: '', consultas: '27' },
  { cliente: 'CARLOS EDUARDO SOUZA', inRequerente: '', ultimoAndamento: 'PETIÇÃO INICIAL PROTOCOLADA', dataConsulta: '18/01/2025', proximaConsulta: '18/02/2025', observacaoProcesso: '', consultor: 'ITAMAR', proc: '445', lmv: '', fase: 'Em Andamento', observacaoFase: '', descricaoAcao: 'AÇÃO DE USUCAPIÃO', prazoFatal: '28/02/2025', competencia: '1ª VARAS CÍVEIS', dataAudiencia: '', horaAudiencia: '', cepReu: '', inv: '', consultas: '5' },
  { cliente: 'FERNANDA LOPES SANTOS', inRequerente: 'REQUERIDO', ultimoAndamento: 'INTIMAÇÃO PARA MANIFESTAÇÃO', dataConsulta: '10/11/2024', proximaConsulta: '10/12/2024', observacaoProcesso: 'Proc. 588', consultor: 'Karla Almeida', proc: '78', lmv: '12', fase: 'Aguardando Peticionamento', observacaoFase: '', descricaoAcao: 'AÇÃO DE DIVÓRCIO', prazoFatal: '', competencia: '1ª VARA DE FAMÍLIA', dataAudiencia: '20/01/2025', horaAudiencia: '10:30', cepReu: '', inv: '12', consultas: '41' },
  { cliente: 'ROBERTO ALVES PEREIRA', inRequerente: '', ultimoAndamento: 'DISTRIBUIÇÃO POR SORTEIO', dataConsulta: '22/09/2024', proximaConsulta: '22/10/2024', observacaoProcesso: '', consultor: 'ITAMAR', proc: '156', lmv: '', fase: 'Em Andamento', observacaoFase: '', descricaoAcao: 'RECLAMATÓRIA TRABALHISTA', prazoFatal: '', competencia: 'VARA DO TRABALHO', dataAudiencia: '', horaAudiencia: '', cepReu: '75000000', inv: '', consultas: '33' },
  { cliente: 'PATRICIA MENDES COSTA', inRequerente: '', ultimoAndamento: 'CITAÇÃO REALIZADA', dataConsulta: '05/08/2024', proximaConsulta: '05/09/2024', observacaoProcesso: '', consultor: 'DAAE', proc: '289', lmv: '', fase: 'Em Andamento', observacaoFase: '', descricaoAcao: 'AÇÃO DE ALIMENTOS', prazoFatal: '15/09/2024', competencia: '1ª VARA DE FAMÍLIA', dataAudiencia: '', horaAudiencia: '', cepReu: '', inv: '', consultas: '14' },
  { cliente: 'VRV LTDA', inRequerente: 'REQUERIDO', ultimoAndamento: 'CONTESTAÇÃO JUNTADA', dataConsulta: '30/06/2024', proximaConsulta: '30/07/2024', observacaoProcesso: 'RENOVAR ALUGUEL', consultor: 'Karla Almeida', proc: '92', lmv: '5', fase: 'Em Andamento', observacaoFase: '', descricaoAcao: 'AÇÃO DE COBRANÇA', prazoFatal: '', competencia: '1ª JUIZADO ESPECIAL CÍVEL', dataAudiencia: '05/08/2024', horaAudiencia: '14:00', cepReu: '', inv: '5', consultas: '48' },
  { cliente: 'MEGA ELITE VIGILANCIA E SEGURANCA', inRequerente: '', ultimoAndamento: 'AGUARDANDO CONCILIAÇÃO', dataConsulta: '12/05/2024', proximaConsulta: '12/06/2024', observacaoProcesso: '', consultor: 'ITAMAR', proc: '112', lmv: '', fase: 'Em Andamento', observacaoFase: '', descricaoAcao: 'AÇÃO DE COBRANÇA', prazoFatal: '', competencia: '2º JUIZADO ESPECIAL CÍVEL', dataAudiencia: '15/06/2024', horaAudiencia: '09:00', cepReu: '', inv: '', consultas: '24' },
  { cliente: 'SSMA SEGURANÇA SAÚDE E MEIO AMBIENTE LTDA', inRequerente: '', ultimoAndamento: 'ACORDO HOMOLOGADO', dataConsulta: '28/04/2024', proximaConsulta: '28/05/2024', observacaoProcesso: '', consultor: 'Karla Almeida', proc: '67', lmv: '', fase: 'Em Andamento', observacaoFase: '', descricaoAcao: 'AÇÃO DE COBRANÇA', prazoFatal: '', competencia: '1ª JUIZADO ESPECIAL CÍVEL', dataAudiencia: '', horaAudiencia: '', cepReu: '', inv: '', consultas: '36' },
  { cliente: 'PRISCILLA SILVA SIQUEIRA', inRequerente: 'REQUERIDO', ultimoAndamento: 'MANIFESTAÇÃO DO MP', dataConsulta: '15/03/2024', proximaConsulta: '15/04/2024', observacaoProcesso: '', consultor: 'DAAE', proc: '34', lmv: '9', fase: 'Aguardando Peticionamento', observacaoFase: '', descricaoAcao: 'RECLAMATÓRIA TRABALHISTA', prazoFatal: '25/04/2024', competencia: 'VARA DO TRABALHO', dataAudiencia: '', horaAudiencia: '', cepReu: '74010000', inv: '9', consultas: '11' },
  { cliente: 'MARÍLIA GABRIELA DE OLIVEIRA DINIZ', inRequerente: '', ultimoAndamento: 'SESSÃO DE JULGAMENTO DESIGNADA', dataConsulta: '01/02/2024', proximaConsulta: '01/03/2024', observacaoProcesso: '', consultor: 'ITAMAR', proc: '178', lmv: '', fase: 'Em Andamento', observacaoFase: '', descricaoAcao: 'AÇÃO DE COBRANÇA', prazoFatal: '', competencia: '1ª VARAS CÍVEIS', dataAudiencia: '10/03/2024', horaAudiencia: '13:30', cepReu: '', inv: '', consultas: '29' },
  { cliente: 'SE77E TELECOM EIRELI ME', inRequerente: '', ultimoAndamento: 'RECURSO CONHECIDO', dataConsulta: '20/01/2024', proximaConsulta: '20/02/2024', observacaoProcesso: '', consultor: 'Karla Almeida', proc: '223', lmv: '14', fase: 'Em Andamento', observacaoFase: '', descricaoAcao: 'AÇÃO DE COBRANÇA', prazoFatal: '', competencia: '1ª JUIZADO ESPECIAL CÍVEL', dataAudiencia: '', horaAudiencia: '', cepReu: '', inv: '14', consultas: '52' },
  { cliente: 'YNAYRA M', inRequerente: 'REQUERIDO', ultimoAndamento: 'DESPACHO DO JUIZ', dataConsulta: '05/12/2023', proximaConsulta: '05/01/2024', observacaoProcesso: '', consultor: 'DAAE', proc: '89', lmv: '', fase: 'Aguardando Peticionamento', observacaoFase: '', descricaoAcao: 'AÇÃO DE COBRANÇA', prazoFatal: '15/01/2024', competencia: '2º JUIZADO ESPECIAL CÍVEL', dataAudiencia: '', horaAudiencia: '', cepReu: '', inv: '', consultas: '17' },
  { cliente: 'MARCELO SOARES DE ALMEIDA', inRequerente: '', ultimoAndamento: 'PAUTA DE JULGAMENTO', dataConsulta: '18/11/2023', proximaConsulta: '18/12/2023', observacaoProcesso: '1 da pauta', consultor: 'ITAMAR', proc: '45', lmv: '', fase: 'Em Andamento', observacaoFase: '', descricaoAcao: 'AÇÃO DE COBRANÇA', prazoFatal: '', competencia: '1ª VARAS CÍVEIS', dataAudiencia: '20/12/2023', horaAudiencia: '09:00', cepReu: '', inv: '', consultas: '43' },
];

export function Relatorio() {
  const navigate = useNavigate();
  const [ordenarPor, setOrdenarPor] = useState(null);
  const [ordemAsc, setOrdemAsc] = useState(true);
  const [dados] = useState(() =>
    relatorioMock.map((row, idx) => ({
      ...row,
      // fallback para manter navegação funcional mesmo sem codCliente explícito no mock
      codCliente: row.codCliente ?? String(idx + 1).padStart(8, '0'),
      // CNJ: prioriza campo novo (API / mock explícito), senão gera determinístico
      numeroProcesso: row.numeroProcesso ?? row.numeroProcessoNovo ?? gerarNumeroProcessoCnjMock(row, idx),
    }))
  );
  const [filtrosPorColuna, setFiltrosPorColuna] = useState(() =>
    COLUNAS.reduce((acc, col) => ({ ...acc, [col.id]: '' }), {})
  );

  const dadosFiltrados = useMemo(() => {
    return dados.filter((row) =>
      COLUNAS.every((col) => {
        const filtro = String(filtrosPorColuna[col.id] ?? '').trim().toLowerCase();
        if (!filtro) return true;
        const valor = String(row[col.id] ?? '').toLowerCase();
        return valor.includes(filtro);
      })
    );
  }, [dados, filtrosPorColuna]);

  const dadosOrdenados = useMemo(() => {
    if (!ordenarPor) return dadosFiltrados;
    return [...dadosFiltrados].sort((a, b) => {
      const va = a[ordenarPor] ?? '';
      const vb = b[ordenarPor] ?? '';
      const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true });
      return ordemAsc ? cmp : -cmp;
    });
  }, [dadosFiltrados, ordenarPor, ordemAsc]);

  const toggleOrdenacao = (id) => {
    if (ordenarPor === id) setOrdemAsc((a) => !a);
    else {
      setOrdenarPor(id);
      setOrdemAsc(true);
    }
  };

  return (
    <div className="min-h-full bg-slate-200 flex flex-col">
      <div className="flex-1 min-h-0 p-3 flex flex-col">
        <header className="mb-2">
          <h1 className="text-xl font-bold text-slate-800">Relatório</h1>
        </header>
        <div className="flex-1 min-h-0 bg-white rounded border border-slate-300 shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-auto flex-1">
            <table className="w-full text-sm border-collapse" style={{ minWidth: 'max-content' }}>
              <thead className="sticky top-0 z-10">
                <tr className="bg-teal-700 text-white">
                  {COLUNAS.map((col) => (
                    <th
                      key={col.id}
                      className="text-left px-2 py-2 font-semibold whitespace-nowrap border-b border-r border-teal-600 last:border-r-0 cursor-pointer hover:bg-teal-600 select-none"
                      style={{ minWidth: col.minW }}
                      onClick={() => toggleOrdenacao(col.id)}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        <ChevronDown className={`w-4 h-4 opacity-80 transition-transform ${ordenarPor === col.id && !ordemAsc ? 'rotate-180' : ''}`} />
                      </span>
                    </th>
                  ))}
                </tr>
                <tr className="bg-slate-100">
                  {COLUNAS.map((col) => (
                    <th
                      key={`${col.id}-filtro`}
                      className="px-1.5 py-1 border-b border-r border-slate-300 last:border-r-0"
                      style={{ minWidth: col.minW }}
                    >
                      <input
                        type="text"
                        value={filtrosPorColuna[col.id] ?? ''}
                        onChange={(e) =>
                          setFiltrosPorColuna((prev) => ({
                            ...prev,
                            [col.id]: e.target.value,
                          }))
                        }
                        placeholder="Filtrar..."
                        className="w-full px-2 py-1 border border-slate-300 rounded text-xs text-slate-700 bg-white"
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dadosOrdenados.length === 0 ? (
                  <tr>
                    <td colSpan={COLUNAS.length} className="px-3 py-6 text-center text-slate-500">
                      Nenhum resultado para os filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  dadosOrdenados.map((row, idx) => (
                    <tr
                      key={idx}
                      className={`border-b border-slate-200 hover:bg-slate-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} cursor-pointer`}
                      title="Duplo clique: abrir processo"
                      onDoubleClick={() =>
                        navigate('/processos', {
                          state: {
                            codCliente: String(row.codCliente ?? ''),
                            proc: String(row.proc ?? ''),
                          },
                        })
                      }
                    >
                      {COLUNAS.map((col) => (
                        <td
                          key={col.id}
                          className="px-2 py-1.5 border-r border-slate-200 last:border-r-0 text-slate-800"
                          style={{ minWidth: col.minW }}
                        >
                          {row[col.id] ?? ''}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
