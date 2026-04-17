import { listarClientesPaginados, buscarCliente } from '../api/clientesService.js';
import { carregarPessoaComplementar } from '../repositories/pessoasComplementaresRepository.js';
import {
  carregarEnderecosPessoa,
  carregarContatosPessoa,
  enderecosApiParaUi,
  contatosApiParaUi,
} from '../repositories/pessoasEnderecosContatosRepository.js';
import { featureFlags } from '../config/featureFlags.js';
import { listarPessoasComDocumento } from './pessoaDocumentoService.js';
import { listarCodigosClientePorIdPessoa } from '../data/clienteCodigoHelpers.js';
import { listarProcessosPorIdPessoa } from '../data/processosHistoricoData.js';

const PAGE_SIZE = 100;

function formatarDataApi(v) {
  if (v == null || v === '') return '';
  if (typeof v === 'string') return v.split('T')[0];
  return String(v);
}

function simNao(v) {
  if (v === true || v === 'true') return 'Sim';
  if (v === false || v === 'false') return 'Não';
  return '';
}

function formatarEnderecosTexto(endsUi) {
  if (!Array.isArray(endsUi) || endsUi.length === 0) return '';
  return endsUi
    .map((e, i) => {
      const partes = [
        e.rua,
        e.numero != null ? `nº ${e.numero}` : '',
        e.bairro,
        e.cidade,
        e.estado,
        e.cep ? `CEP ${e.cep}` : '',
      ].filter(Boolean);
      return `[${i + 1}] ${partes.join(', ')}`;
    })
    .join(' | ');
}

function formatarContatosTexto(contsUi) {
  if (!Array.isArray(contsUi) || contsUi.length === 0) return '';
  return contsUi
    .map((c, i) => `[${i + 1}] ${String(c.tipo ?? '')}: ${String(c.valor ?? '')}`)
    .join(' | ');
}

function formatarVinculosCliente(codigos) {
  if (!Array.isArray(codigos) || codigos.length === 0) return '';
  return codigos.join('; ');
}

function formatarVinculosProcessos(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return '';
  return rows
    .map(
      (r) =>
        `Cliente ${r.codCliente} Proc.${r.proc} (${String(r.papeis ?? '').trim() || '—'})`
    )
    .join(' | ');
}

/**
 * Interpreta lista de IDs de pessoas (cadastro), separados por `;`.
 * Ex.: `"200; 201; 209; 404"` — ignora vazios, duplicados e tokens inválidos.
 *
 * @param {string} raw
 * @returns {number[]}
 */
export function parsearIdsListaExportacaoPessoas(raw) {
  const out = [];
  const seen = new Set();
  for (const seg of String(raw ?? '').split(';')) {
    const t = String(seg).trim();
    if (!t) continue;
    const n = Math.floor(Number(t));
    if (!Number.isFinite(n) || n < 1) continue;
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

/**
 * Percorre páginas da API e devolve IDs conforme o modo.
 *
 * @param {'filtros'|'intervalo'|'quantidade'} modo
 * @param {{ apenasAtivos?: boolean, nome?: string, cpf?: string, codigo?: number, cpfAdicional?: string }} filtrosListagem
 * @param {{ idDe: number, idAte: number }} [intervalo]
 * @param {number} [quantidadeMax]
 * @param {(ev: { fase: string, page: number, idsColetados: number }) => void} [onProgress]
 */
export async function coletarIdsExportacaoPessoas(modo, filtrosListagem, intervalo, quantidadeMax, onProgress) {
  const base = {
    apenasAtivos: Boolean(filtrosListagem?.apenasAtivos),
    nome: filtrosListagem?.nome,
    cpf: filtrosListagem?.cpf,
    codigo: filtrosListagem?.codigo,
    cpfAdicional: filtrosListagem?.cpfAdicional,
    size: PAGE_SIZE,
    sort: 'id,asc',
  };

  const idDe = modo === 'intervalo' ? Math.floor(Number(intervalo?.idDe)) : null;
  const idAte = modo === 'intervalo' ? Math.floor(Number(intervalo?.idAte)) : null;
  if (modo === 'intervalo') {
    if (!Number.isFinite(idDe) || !Number.isFinite(idAte) || idDe < 1 || idAte < 1 || idDe > idAte) {
      throw new Error('Intervalo inválido: informe IDs de e até (números ≥ 1, «de» menor ou igual a «até»).');
    }
  }
  const qMax =
    modo === 'quantidade'
      ? Math.min(50_000, Math.max(1, Math.floor(Number(quantidadeMax) || 0)))
      : null;
  if (modo === 'quantidade' && (!Number.isFinite(qMax) || qMax < 1)) {
    throw new Error('Informe a quantidade de pessoas a exportar (número ≥ 1).');
  }

  const ids = [];
  let page = 0;

  while (true) {
    onProgress?.({ fase: 'listagem', page, idsColetados: ids.length });
    const res = await listarClientesPaginados({ ...base, page });
    const content = Array.isArray(res?.content) ? res.content : [];

    for (const row of content) {
      const id = Number(row.id);
      if (!Number.isFinite(id) || id < 1) continue;
      if (modo === 'intervalo') {
        if (id < idDe || id > idAte) continue;
      }
      ids.push(id);
      if (modo === 'quantidade' && ids.length >= qMax) {
        onProgress?.({ fase: 'listagem', page, idsColetados: ids.length });
        return ids.slice(0, qMax);
      }
    }

    if (modo === 'quantidade' && ids.length >= qMax) {
      return ids.slice(0, qMax);
    }

    const totalPages = Number(res?.totalPages ?? 0);
    const isLast =
      res?.last === true ||
      content.length < PAGE_SIZE ||
      (totalPages > 0 && page >= totalPages - 1);
    if (isLast) break;
    page += 1;
  }

  if (modo === 'quantidade') return ids.slice(0, qMax);
  return ids;
}

async function montarLinhaExportacao(id, clientesCodigosLista, idsComDocumentoSet) {
  const base = await buscarCliente(id);
  if (!base) return null;

  const comp = await carregarPessoaComplementar(id);
  let endsUi = [];
  let contsUi = [];
  if (featureFlags.useApiPessoasComplementares) {
    try {
      const [rawEnds, rawConts] = await Promise.all([
        carregarEnderecosPessoa(id),
        carregarContatosPessoa(id),
      ]);
      endsUi = enderecosApiParaUi(rawEnds || []);
      contsUi = contatosApiParaUi(rawConts || []);
    } catch {
      endsUi = [];
      contsUi = [];
    }
  }

  const nome = String(base.nome ?? '').trim();
  const codigosCliente = listarCodigosClientePorIdPessoa(id, clientesCodigosLista || []);
  const processos = listarProcessosPorIdPessoa(id, nome);
  const comDoc = idsComDocumentoSet?.has(String(id)) ?? false;

  const resp = base.responsavel;
  return {
    id: base.id,
    nome: base.nome ?? '',
    cpf: base.cpf ?? '',
    email: base.email ?? '',
    telefone: base.telefone ?? '',
    dataNascimento: formatarDataApi(base.dataNascimento),
    ativo: simNao(base.ativo !== false),
    marcadoMonitoramento: simNao(base.marcadoMonitoramento === true),
    nacionalidade: comp?.nacionalidade ?? '',
    rg: comp?.rg ?? '',
    orgaoExpedidor: comp?.orgaoExpedidor ?? '',
    profissao: comp?.profissao ?? '',
    estadoCivil: comp?.estadoCivil ?? '',
    genero: comp?.genero ?? '',
    responsavelId: base.responsavelId ?? '',
    responsavelNome: resp?.nome ?? '',
    responsavelCpf: resp?.cpf ?? '',
    enderecos: formatarEnderecosTexto(endsUi),
    contatos: formatarContatosTexto(contsUi),
    codigosClienteVinculo: formatarVinculosCliente(codigosCliente),
    processosVinculoResumo: formatarVinculosProcessos(processos),
    documentoPessoalAnexado: comDoc ? 'Sim' : 'Não',
  };
}

const COLUNAS_PT = [
  ['id', 'ID'],
  ['nome', 'Nome'],
  ['cpf', 'CPF/CNPJ'],
  ['email', 'E-mail'],
  ['telefone', 'Telefone'],
  ['dataNascimento', 'Data nascimento'],
  ['ativo', 'Ativo'],
  ['marcadoMonitoramento', 'Monitoramento'],
  ['nacionalidade', 'Nacionalidade'],
  ['rg', 'RG'],
  ['orgaoExpedidor', 'Órgão expedidor'],
  ['profissao', 'Profissão'],
  ['estadoCivil', 'Estado civil'],
  ['genero', 'Gênero'],
  ['responsavelId', 'ID responsável'],
  ['responsavelNome', 'Nome responsável'],
  ['responsavelCpf', 'CPF responsável'],
  ['enderecos', 'Endereços'],
  ['contatos', 'Contatos'],
  ['codigosClienteVinculo', 'Códigos cliente (vínculo)'],
  ['processosVinculoResumo', 'Processos (resumo)'],
  ['documentoPessoalAnexado', 'Documento pessoal anexado'],
];

/**
 * Exporta pessoas para ficheiro .xlsx (descarrega no browser).
 *
 * @param {number[]} ids
 * @param {unknown[]} clientesCodigosLista — mesmo formato que `listarClientesCadastro` (para vínculos).
 * @param {(ev: { fase: string, atual: number, total: number }) => void} [onProgress]
 * @returns {Promise<{ linhas: number, nomeArquivo: string }>}
 */
export async function exportarPessoasParaXlsx(ids, clientesCodigosLista, onProgress) {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new Error('Nenhuma pessoa a exportar para o intervalo ou filtros escolhidos.');
  }

  const docSet = new Set(listarPessoasComDocumento().map((x) => String(x)));
  const XLSX = await import('xlsx');
  const ordered = [];
  for (let i = 0; i < ids.length; i += 1) {
    const id = ids[i];
    onProgress?.({ fase: 'detalhes', atual: i + 1, total: ids.length });
    const row = await montarLinhaExportacao(id, clientesCodigosLista, docSet);
    ordered.push(row || { id, nome: '(não encontrada na API)' });
  }
  const header = COLUNAS_PT.map(([, label]) => label);
  const keys = COLUNAS_PT.map(([k]) => k);
  const aoa = [header, ...ordered.map((r) => keys.map((k) => r[k] ?? ''))];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pessoas');
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '').replace('T', '_');
  const nomeArquivo = `pessoas_export_${stamp}.xlsx`;
  XLSX.writeFile(wb, nomeArquivo);
  return { linhas: ordered.length, nomeArquivo };
}
