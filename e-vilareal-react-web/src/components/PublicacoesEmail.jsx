import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Link2,
  Loader2,
  Mail,
  RefreshCw,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import { useCloseOnEscape } from '../hooks/useCloseOnEscape.js';
import {
  buscarPublicacoesEmail,
  obterSyncPublicacoesEmail,
  processarEmailsAgora,
} from '../api/publicacoesEmailApi.js';
import {
  buscarManifestacoesProjudi,
  obterSyncProjudi,
  processarEmailsProjudiAgora,
} from '../api/manifestacoesProjudiApi.js';
import {
  formatarPartesLinha,
  parseProjudiMeta,
  teorParaExibicao,
  tipoMovimentoLinha,
} from '../data/manifestacoesProjudiDisplay.js';
import { buildRouterStateChaveClienteProcesso } from '../domain/camposProcessoCliente.js';
import { mensagemErroAmigavel } from '../utils/mensagemErroAmigavel.js';
import {
  normalizarCodigoClienteFinanceiro,
  normalizarProcFinanceiro,
} from '../data/financeiroData.js';
import { ModalVinculoClienteProcFinanceiro } from './ModalVinculoClienteProcFinanceiro.jsx';
import {
  formatarChaveProcessoVinculo,
  formatarRotuloVinculoPartes,
  obterTitularNomeLinha,
} from '../data/publicacoesDisplayHelpers.js';
import {
  buscarHitIndiceCnjPorCnj,
  montarIndiceCnjClienteProcAsync,
  resolverSugestaoVinculoLinha,
} from '../data/publicacoesVinculoProcessos.js';
import {
  alterarStatusPublicacao,
  carregarSugestoesVinculoPorPublicacoes,
  vincularPublicacaoProcessoAutomatico,
  vincularPublicacaoProcessoPorChaveNatural,
} from '../repositories/publicacoesRepository.js';

const ProcessosLazy = lazy(() =>
  import('./Processos.jsx').then((module) => ({ default: module.Processos }))
);

const STATUS_OPCOES = [
  { value: '', label: 'Todos' },
  { value: 'PENDENTE', label: 'Pendente' },
  { value: 'VINCULADA', label: 'Vinculada' },
  { value: 'TRATADA', label: 'Tratada' },
  { value: 'IGNORADA', label: 'Ignorada' },
];

const VINCULO_FILTRO_OPCOES = [
  { value: 'todos', label: 'Todos os vínculos' },
  { value: 'nao_vinculados', label: 'Não vinculados' },
];

const VARIANT_CONFIG = {
  jusbrasil: {
    titulo: 'Publicações por Email',
    remetente: 'publicacoes-diarios@jusbrasil.com.br',
    voltarPara: '/processos/publicacoes',
    voltarLabel: 'Publicações (PDF)',
    buscar: buscarPublicacoesEmail,
    processar: processarEmailsAgora,
    syncObter: obterSyncPublicacoesEmail,
    vazio: 'Nenhuma publicação importada por email encontrada.',
    resumoTipo: 'publicação',
    placeholderBusca: 'Buscar no teor, CNJ, cliente…',
  },
  projudi: {
    titulo: 'Movimentações Email',
    remetente: 'Projudi TJGO + TRT (PUSH)',
    voltarPara: '/processos',
    voltarLabel: 'Processos',
    buscar: buscarManifestacoesProjudi,
    processar: processarEmailsProjudiAgora,
    syncObter: obterSyncProjudi,
    vazio: 'Nenhuma movimentação por email (Projudi / TRT) encontrada.',
    resumoTipo: 'manifestação',
    placeholderBusca: 'Buscar movimento, CNJ, partes, código…',
    autoAplicarSugestoes: true,
  },
};

const STATUS_LABEL = {
  PENDENTE: 'Pendente',
  VINCULADA: 'Vinculada',
  TRATADA: 'Tratada',
  IGNORADA: 'Ignorada',
};

function Badge({ children, tone = 'slate' }) {
  const cls = {
    slate: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
    green: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200',
    amber: 'bg-amber-100 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100',
    red: 'bg-red-100 text-red-900 dark:bg-red-950/40 dark:text-red-200',
  }[tone];
  return <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold ${cls}`}>{children}</span>;
}

function BadgeNoDrive({ row }) {
  if (!row?.andamentosNoDrive || !row?.driveFolderUrl) return null;
  return (
    <a
      href={row.driveFolderUrl}
      target="_blank"
      rel="noopener noreferrer"
      title="Abrir pasta Movimentações no Drive"
      className="ml-1.5 inline-flex shrink-0 items-center gap-0.5"
      onClick={(e) => e.stopPropagation()}
    >
      <Badge tone="green">No Drive</Badge>
    </a>
  );
}

function fmtDataBr(isoDate) {
  if (!isoDate) return '—';
  const s = String(isoDate);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [y, m, d] = s.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }
  return s;
}

function parseDataPublicacaoMs(isoDate) {
  if (!isoDate) return Number.NEGATIVE_INFINITY;
  const s = String(isoDate).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const t = new Date(s.slice(0, 10)).getTime();
    return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t;
  }
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) {
    const t = new Date(`${br[3]}-${br[2]}-${br[1]}`).getTime();
    return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t;
  }
  return Number.NEGATIVE_INFINITY;
}

/** Ordenação: recebimento do email (se houver), senão data de publicação. */
function parseLinhaTempoMs(row) {
  const recebido = row?.emailRecebidoEm;
  if (recebido) {
    const t = new Date(recebido).getTime();
    if (!Number.isNaN(t)) return t;
  }
  return parseDataPublicacaoMs(row?.dataPublicacao);
}

function fmtInstant(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR');
  } catch {
    return String(iso);
  }
}

function truncarTeor(texto, max = 150) {
  const t = String(texto ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return '—';
  if (t.length <= max) return t;
  return `${t.slice(0, max).trim()}…`;
}

function badgeStatusClass(status) {
  switch (status) {
    case 'VINCULADA':
      return 'bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200';
    case 'TRATADA':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200';
    case 'IGNORADA':
      return 'bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-400';
    default:
      return 'bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100';
  }
}

function cnjLinha(row) {
  return row.numeroProcessoEncontrado || row.numero_processo_cnj || row.processoCnjNormalizado || '—';
}

function teorLinha(row, isProjudi = false) {
  if (isProjudi) return teorParaExibicao(row);
  return row.teor || row.teorIntegral || '';
}

function parseProcessosCitadosNoTeor(jsonReferencia) {
  if (!jsonReferencia) return [];
  try {
    const o = typeof jsonReferencia === 'string' ? JSON.parse(jsonReferencia) : jsonReferencia;
    const arr = o?.processosCitadosNoTeor;
    return Array.isArray(arr) ? arr.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function construirStateProcessosDesdeLinha(row, indiceCnj, sugestoesApi) {
  const sug = resolverSugestaoVinculoLinha(row, indiceCnj, sugestoesApi);
  const codRaw = row?.codCliente || sug?.codCliente;
  const procRaw =
    row?.procInterno != null && String(row.procInterno).trim() !== '' ? row.procInterno : sug?.procInterno;
  const cod = codRaw != null && String(codRaw).trim() !== '' ? String(codRaw).trim() : '';
  if (!cod) {
    window.alert(
      'Não há código de cliente para abrir o processo. Vincule à publicação ou confira a sugestão de cadastro.'
    );
    return null;
  }
  const procNum = Number(procRaw);
  if (!Number.isFinite(procNum) || procNum < 1) {
    window.alert('Não há número de processo interno (proc.) sugerido ou vinculado para abrir o cadastro.');
    return null;
  }
  return buildRouterStateChaveClienteProcesso(cod, procNum);
}

function ModalTeor({ publicacao, onClose, onAbrirProcesso, isProjudi = false }) {
  if (!publicacao) return null;
  const citados = parseProcessosCitadosNoTeor(publicacao.jsonCnjBruto || publicacao.jsonReferencia);
  const projudiMeta = isProjudi ? parseProjudiMeta(publicacao) : {};
  const vinculoLabel = formatarRotuloVinculoPartes(publicacao);
  const temVinculoInterno =
    (publicacao.codCliente && publicacao.procInterno) || publicacao.statusVinculo === 'vinculado';
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-teor-titulo"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl dark:bg-[#141922] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-white/10">
          <h2 id="modal-teor-titulo" className="text-base font-semibold">
            Teor completo
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3 overflow-y-auto p-4 text-sm">
          <div className="grid gap-2 sm:grid-cols-2">
            <p>
              <span className="font-medium text-slate-600 dark:text-slate-400">Processo:</span>{' '}
              {cnjLinha(publicacao)}
            </p>
            {isProjudi ? (
              <>
                <p>
                  <span className="font-medium text-slate-600 dark:text-slate-400">Tipo movimento:</span>{' '}
                  {tipoMovimentoLinha(publicacao)}
                </p>
                <p className="sm:col-span-2">
                  <span className="font-medium text-slate-600 dark:text-slate-400">Partes:</span>{' '}
                  {formatarPartesLinha(publicacao)}
                </p>
                {projudiMeta.assuntoEmail ? (
                  <p className="sm:col-span-2">
                    <span className="font-medium text-slate-600 dark:text-slate-400">Assunto do email:</span>{' '}
                    {projudiMeta.assuntoEmail}
                  </p>
                ) : null}
              </>
            ) : null}
            <p>
              <span className="font-medium text-slate-600 dark:text-slate-400">Data publicação:</span>{' '}
              {fmtDataBr(publicacao.dataPublicacao)}
            </p>
            <p>
              <span className="font-medium text-slate-600 dark:text-slate-400">Status:</span>{' '}
              {STATUS_LABEL[publicacao._statusTratamento] || publicacao._statusTratamento || 'PENDENTE'}
            </p>
            <p>
              <span className="font-medium text-slate-600 dark:text-slate-400">Email recebido:</span>{' '}
              {fmtInstant(publicacao.emailRecebidoEm)}
            </p>
            <p className="sm:col-span-2">
              <span className="font-medium text-slate-600 dark:text-slate-400">Origem:</span>{' '}
              {publicacao.arquivoOrigem || publicacao.arquivoOrigemNome || '—'}
            </p>
          </div>
          {citados.length > 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 dark:border-white/10 dark:bg-white/5">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Processos citados no teor (referência — não são publicações principais)
              </p>
              <ul className="mt-2 list-inside list-disc font-mono text-[11px] text-slate-700 dark:text-slate-300">
                {citados.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed dark:border-white/10 dark:bg-white/5">
            {teorLinha(publicacao, isProjudi) || '—'}
          </pre>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-4 py-3 dark:border-white/10">
          <p className="min-w-0 truncate text-[11px] text-slate-500 dark:text-slate-400" title={vinculoLabel}>
            {temVinculoInterno ? vinculoLabel : 'Vincule ou use sugestão de cadastro para abrir o processo.'}
          </p>
          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            {onAbrirProcesso ? (
              <button
                type="button"
                onClick={onAbrirProcesso}
                className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700"
              >
                <FolderOpen className="h-4 w-4" />
                Abrir processo
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function montarResumoVinculoPublicacao(row, isProjudi) {
  const partes = [];
  const cnj = cnjLinha(row);
  if (cnj && cnj !== '—') partes.push(cnj);
  if (isProjudi) {
    const tipo = tipoMovimentoLinha(row);
    if (tipo) partes.push(tipo);
  }
  if (row.emailRecebidoEm) partes.push(fmtInstant(row.emailRecebidoEm));
  return partes.join(' · ') || 'Movimentação por email';
}

function CelulaClienteProc({ row, indiceCnj, sugestoesApi }) {
  const linha = (r, destaque) => {
    const chave = formatarChaveProcessoVinculo(r);
    const titular = obterTitularNomeLinha(r);
    const cls = destaque
      ? 'font-medium text-sky-800 dark:text-sky-200'
      : 'text-slate-700 dark:text-slate-300';
    const subCls = destaque
      ? 'text-sky-700/90 dark:text-sky-300/90'
      : 'text-slate-500 dark:text-slate-400';
    return (
      <>
        <div className={cls} title={chave}>
          {chave}
        </div>
        <div className={`truncate text-[10px] ${subCls}`} title={titular}>
          {titular || '—'}
        </div>
      </>
    );
  };
  if (row.statusVinculo === 'vinculado' && (row.codCliente || row._processoId)) {
    return linha(row, false);
  }
  const sug = resolverSugestaoVinculoLinha(row, indiceCnj, sugestoesApi);
  if (sug) {
    return linha(
      {
        codCliente: sug.codCliente,
        procInterno: sug.procInterno,
        processoId: sug.processoId,
        titularNome: sug.titularNome || sug.parteCliente,
        parteCliente: sug.parteCliente,
        cliente: sug.cliente,
      },
      true
    );
  }
  return linha(row, false);
}

function CelulaVinculo({ row, indiceCnj, sugestoesApi, carregandoSugestoes, onAbrirProcesso, onAplicarSugestao }) {
  const sug = resolverSugestaoVinculoLinha(row, indiceCnj, sugestoesApi);
  if (row.statusVinculo === 'vinculado') {
    const rotulo = formatarRotuloVinculoPartes(row);
    return (
      <div
        className="min-w-0 cursor-pointer overflow-hidden"
        title={`${rotulo}\nDuplo clique: abrir Processos`}
        onDoubleClick={onAbrirProcesso}
      >
        <Badge tone="green">Vinculado</Badge>
        <div className="mt-0.5 truncate text-[10px] text-slate-600 dark:text-slate-400">{rotulo}</div>
      </div>
    );
  }
  return (
    <div
      className="min-w-0 cursor-pointer overflow-hidden"
      onDoubleClick={onAbrirProcesso}
      title="Duplo clique: abrir Processos (se houver sugestão)"
    >
      <Badge tone="amber">{row.statusVinculo === 'nao_vinculado' ? 'Não vinculado' : 'Pendente'}</Badge>
      {carregandoSugestoes && !sug ? (
        <div className="mt-1 flex items-center gap-1 text-[10px] text-slate-500">
          <Loader2 className="h-3 w-3 animate-spin" />
          Buscando sugestão…
        </div>
      ) : null}
      {sug ? (
        <div
          className="mt-1 space-y-0.5 text-[10px] text-slate-600 dark:text-slate-400"
          title={[sug.cliente, formatarChaveProcessoVinculo(sug)].filter(Boolean).join(' · ')}
        >
          <Badge tone="slate">
            Sugestão{sug.fonte === 'api' ? ' (API)' : ''}
            {sug.ambiguo ? ' · amb.' : ''}
          </Badge>
          <div className="truncate font-medium text-sky-800 dark:text-sky-200">{sug.cliente || '—'}</div>
          {onAplicarSugestao ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAplicarSugestao();
              }}
              className="mt-0.5 w-full truncate rounded border border-sky-300 px-1 py-0.5 text-[10px] font-medium text-sky-800 hover:bg-sky-50 dark:border-sky-500/40 dark:text-sky-200 dark:hover:bg-sky-950/30"
            >
              Aplicar
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const TOOLTIP_ACOES_LINHA = {
  vincular:
    'Associar esta movimentação a um processo do cadastro (escolher cliente e nº interno).',
  auto:
    'Vincular automaticamente pelo CNJ ao processo já cadastrado no sistema.',
  vinculada:
    'Marcar como vinculada na fila (controle de triagem), sem abrir o cadastro do processo.',
  tratar:
    'Marcar como tratada — movimentação revisada e concluída na sua fila.',
  ignorar:
    'Marcar como ignorada — sem providência (aviso duplicado, irrelevante, etc.).',
};

function AcoesLinha({ onVincular, onAuto, onTratar, onIgnorar, onMarcarVinculada }) {
  return (
    <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        title={TOOLTIP_ACOES_LINHA.vincular}
        onClick={onVincular}
        className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-[10px] font-medium hover:bg-slate-100 dark:border-white/15 dark:hover:bg-white/5"
      >
        <Link2 className="h-3 w-3" />
        Vincular
      </button>
      <button
        type="button"
        title={TOOLTIP_ACOES_LINHA.auto}
        onClick={onAuto}
        className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-[10px] font-medium hover:bg-slate-100 dark:border-white/15 dark:hover:bg-white/5"
      >
        <RotateCcw className="h-3 w-3" />
        Auto
      </button>
      <button
        type="button"
        title={TOOLTIP_ACOES_LINHA.vinculada}
        onClick={onMarcarVinculada}
        className="inline-flex items-center gap-1 rounded border border-sky-200 px-2 py-1 text-[10px] font-medium text-sky-800 hover:bg-sky-50 dark:border-sky-500/40 dark:text-sky-200 dark:hover:bg-sky-950/30"
      >
        Vinculada
      </button>
      <button
        type="button"
        title={TOOLTIP_ACOES_LINHA.tratar}
        onClick={onTratar}
        className="inline-flex items-center gap-1 rounded border border-emerald-200 px-2 py-1 text-[10px] font-medium text-emerald-800 hover:bg-emerald-50 dark:border-emerald-500/40 dark:text-emerald-200 dark:hover:bg-emerald-950/30"
      >
        Tratar
      </button>
      <button
        type="button"
        title={TOOLTIP_ACOES_LINHA.ignorar}
        onClick={onIgnorar}
        className="inline-flex items-center gap-1 rounded border border-amber-200 px-2 py-1 text-[10px] font-medium text-amber-800 hover:bg-amber-50 dark:border-amber-500/40 dark:text-amber-200 dark:hover:bg-amber-950/30"
      >
        Ignorar
      </button>
    </div>
  );
}

function CardMobileRow({
  row,
  indiceCnj,
  sugestoesApi,
  carregandoSugestoes,
  expandido,
  onToggle,
  onAbrirProcesso,
  onAplicarSugestao,
  onVincular,
  onAuto,
  onTratar,
  onIgnorar,
  onMarcarVinculada,
  isProjudi = false,
  teorDaLinha,
}) {
  const status = row._statusTratamento || 'PENDENTE';
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-[#141922]">
      <button type="button" onClick={onToggle} className="w-full text-left">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs text-slate-500">{fmtDataBr(row.dataPublicacao)}</p>
            <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${badgeStatusClass(status)}`}>
              {STATUS_LABEL[status] || status}
            </span>
          </div>
          {expandido ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          )}
        </div>
        <p className="mt-2 font-mono text-xs text-sky-800 dark:text-sky-300">
          {cnjLinha(row)}
          <BadgeNoDrive row={row} />
        </p>
        {isProjudi ? (
          <>
            <p className="mt-1 text-xs font-medium text-violet-900 dark:text-violet-200">
              {tipoMovimentoLinha(row)}
            </p>
            <p className="mt-1 line-clamp-2 text-xs text-slate-700 dark:text-slate-300">
              {formatarPartesLinha(row)}
            </p>
          </>
        ) : (
          <p className="mt-1 line-clamp-3 text-xs text-slate-700 dark:text-slate-300">
            {truncarTeor(teorDaLinha(row), 150)}
          </p>
        )}
      </button>
      <div className="mt-2 border-t border-slate-100 pt-2 dark:border-white/10">
        <CelulaVinculo
          row={row}
          indiceCnj={indiceCnj}
          sugestoesApi={sugestoesApi}
          carregandoSugestoes={carregandoSugestoes}
          onAbrirProcesso={onAbrirProcesso}
          onAplicarSugestao={onAplicarSugestao}
        />
        <div className="mt-2">
          <AcoesLinha
            onVincular={onVincular}
            onAuto={onAuto}
            onTratar={onTratar}
            onIgnorar={onIgnorar}
            onMarcarVinculada={onMarcarVinculada}
          />
        </div>
      </div>
      {expandido ? (
        <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 p-2 text-xs dark:border-white/10 dark:bg-white/5">
          {teorDaLinha(row) || '—'}
        </pre>
      ) : null}
    </article>
  );
}

export function PublicacoesEmail({ variant = 'jusbrasil' }) {
  const cfg = VARIANT_CONFIG[variant] ?? VARIANT_CONFIG.jusbrasil;
  const isProjudi = variant === 'projudi';
  const navigate = useNavigate();

  const teorDaLinha = useCallback((row) => teorLinha(row, isProjudi), [isProjudi]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processando, setProcessando] = useState(false);
  const [err, setErr] = useState('');
  const [msgOk, setMsgOk] = useState('');
  const [buscaTexto, setBuscaTexto] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroVinculo, setFiltroVinculo] = useState('todos');
  const [buscaDebounced, setBuscaDebounced] = useState('');
  const [resultadoProcessamento, setResultadoProcessamento] = useState(null);
  const [ultimaSyncGmail, setUltimaSyncGmail] = useState(null);
  const [processandoCompleto, setProcessandoCompleto] = useState(false);
  const [expandidoId, setExpandidoId] = useState(null);
  const [modalPublicacao, setModalPublicacao] = useState(null);
  const [processoEmbed, setProcessoEmbed] = useState(null);
  const [indiceCnj, setIndiceCnj] = useState(new Map());
  const [sugestoesApi, setSugestoesApi] = useState(() => new Map());
  const [carregandoSugestoes, setCarregandoSugestoes] = useState(false);
  const [vinculoModal, setVinculoModal] = useState(null);
  const [ordemDataAsc, setOrdemDataAsc] = useState(false);
  const [aplicandoSugestoes, setAplicandoSugestoes] = useState(false);
  const sugestoesAutoTentadasRef = useRef(new Set());

  useEffect(() => {
    void montarIndiceCnjClienteProcAsync().then((m) => setIndiceCnj(m));
  }, []);

  useEffect(() => {
    if (indiceCnj.size === 0 && rows.length > 0) {
      void montarIndiceCnjClienteProcAsync().then((m) => {
        if (m.size > 0) setIndiceCnj(m);
      });
    }
  }, [rows.length, indiceCnj.size]);

  useEffect(() => {
    if (!rows.length) {
      setSugestoesApi(new Map());
      setCarregandoSugestoes(false);
      return undefined;
    }
    let cancelled = false;
    setCarregandoSugestoes(true);
    void carregarSugestoesVinculoPorPublicacoes(rows).then((m) => {
      if (!cancelled) {
        setSugestoesApi(m);
        setCarregandoSugestoes(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [rows]);

  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(buscaTexto.trim()), 400);
    return () => clearTimeout(t);
  }, [buscaTexto]);

  useCloseOnEscape(!!vinculoModal && !processoEmbed, () => setVinculoModal(null));
  useCloseOnEscape(!!modalPublicacao && !processoEmbed && !vinculoModal, () => setModalPublicacao(null));

  const carregar = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const data = await cfg.buscar({
        texto: buscaDebounced || undefined,
        status: filtroStatus || undefined,
        filtroVinculo,
      });
      setRows(data);
    } catch (e) {
      setErr(mensagemErroAmigavel(e, 'carregar as publicações por email'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [buscaDebounced, filtroStatus, filtroVinculo, cfg]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const carregarSyncGmail = useCallback(async () => {
    try {
      const s = await cfg.syncObter();
      setUltimaSyncGmail(s?.ultimaSincronizacaoEm ?? null);
    } catch {
      setUltimaSyncGmail(null);
    }
  }, [cfg]);

  useEffect(() => {
    void carregarSyncGmail();
  }, [carregarSyncGmail]);

  const rowsExibidas = useMemo(() => {
    return [...rows].sort((a, b) => {
      const da = parseLinhaTempoMs(a);
      const db = parseLinhaTempoMs(b);
      if (da !== db) return ordemDataAsc ? da - db : db - da;
      return Number(b.id ?? 0) - Number(a.id ?? 0);
    });
  }, [rows, ordemDataAsc]);

  const totalLabel = useMemo(() => {
    const n = rows.length;
    const processosUnicos = new Set(
      rows.map((r) => String(cnjLinha(r)).trim().toUpperCase()).filter((c) => c !== '—')
    ).size;
    const comSugestao = rows.filter(
      (r) => r.statusVinculo !== 'vinculado' && resolverSugestaoVinculoLinha(r, indiceCnj, sugestoesApi)
    ).length;
    const temFiltro = Boolean(buscaDebounced || filtroStatus || filtroVinculo !== 'todos');
    const sugestaoTxt =
      comSugestao > 0
        ? ` · ${comSugestao} com sugestão de vínculo${carregandoSugestoes ? ' (carregando…)' : ''}`
        : carregandoSugestoes
          ? ' · buscando sugestões de vínculo…'
          : '';
    const tipo = cfg.resumoTipo;
    const tipoPlural = tipo === 'manifestação' ? 'manifestações' : 'publicações';
    if (temFiltro) {
      return `${n} ${tipoPlural} · ${processosUnicos} processo${processosUnicos === 1 ? '' : 's'} único${processosUnicos === 1 ? '' : 's'} (filtro ativo)${sugestaoTxt}`;
    }
    return `${n} ${tipoPlural} · ${processosUnicos} processo${processosUnicos === 1 ? '' : 's'} único${processosUnicos === 1 ? '' : 's'} por email${sugestaoTxt}`;
  }, [rows, buscaDebounced, filtroStatus, filtroVinculo, indiceCnj, sugestoesApi, carregandoSugestoes, cfg]);

  const handleProcessar = async (forcarAtualizacaoCompleta = false) => {
    if (forcarAtualizacaoCompleta) {
      setProcessandoCompleto(true);
    } else {
      setProcessando(true);
    }
    setErr('');
    setMsgOk('');
    setResultadoProcessamento(null);
    try {
      const res = await cfg.processar({ forcar: forcarAtualizacaoCompleta });
      setResultadoProcessamento(res);
      if (res?.ultimaSincronizacaoGravada) {
        setUltimaSyncGmail(res.ultimaSincronizacaoGravada);
      } else {
        await carregarSyncGmail();
      }
      await carregar();
    } catch (e) {
      setErr(mensagemErroAmigavel(e, 'processar os emails'));
    } finally {
      setProcessando(false);
      setProcessandoCompleto(false);
    }
  };

  const alterarStatus = async (row, status) => {
    setErr('');
    setMsgOk('');
    try {
      await alterarStatusPublicacao(row._apiId ?? row.id, status, 'Atualização na tela de publicações por email.');
      setMsgOk(`Status atualizado para ${STATUS_LABEL[status] || status}.`);
      await carregar();
    } catch (e) {
      setErr(mensagemErroAmigavel(e, 'atualizar o status'));
    }
  };

  const abrirVinculoModal = (row) => {
    const sug = resolverSugestaoVinculoLinha(row, indiceCnj, sugestoesApi);
    let resumo = montarResumoVinculoPublicacao(row, isProjudi);
    if (sug?.ambiguo) {
      resumo += ' · Atenção: mais de um processo com CNJ semelhante — escolha o cliente e o proc. na lista';
    }
    setVinculoModal({ id: row.id, resumo });
  };

  const aplicarSugestaoVinculo = async (row) => {
    const sug = resolverSugestaoVinculoLinha(row, indiceCnj, sugestoesApi);
    if (!sug?.codCliente || !sug?.procInterno) {
      setErr('Não há sugestão de vínculo para este CNJ no cadastro.');
      return;
    }
    setErr('');
    setMsgOk('');
    try {
      const vinculado = await vincularPublicacaoProcessoPorChaveNatural(
        row._apiId ?? row.id,
        sug.codCliente,
        sug.procInterno,
        'Vínculo pela sugestão de cadastro (CNJ).'
      );
      if (vinculado == null) {
        setErr('Não foi possível aplicar a sugestão na API.');
        return;
      }
      setMsgOk('Sugestão de vínculo aplicada com sucesso.');
      await carregar();
    } catch (e) {
      setErr(mensagemErroAmigavel(e, 'aplicar a sugestão de vínculo'));
    }
  };

  const coletarSugestoesAplicaveis = useCallback(
    (somenteNaoTentadas) => {
      const pendentes = [];
      for (const row of rows) {
        if (row.statusVinculo === 'vinculado') continue;
        const sug = resolverSugestaoVinculoLinha(row, indiceCnj, sugestoesApi);
        if (!sug || sug.ambiguo === true || !sug.codCliente || !sug.procInterno) continue;
        const id = row._apiId ?? row.id;
        if (somenteNaoTentadas && sugestoesAutoTentadasRef.current.has(String(id))) continue;
        pendentes.push({ id, sug });
      }
      return pendentes;
    },
    [rows, indiceCnj, sugestoesApi]
  );

  const aplicarTodasSugestoes = useCallback(
    async ({ auto = false } = {}) => {
      const pendentes = coletarSugestoesAplicaveis(auto);
      if (pendentes.length === 0) {
        if (!auto) setMsgOk('Nenhuma sugestão de vínculo aplicável no momento.');
        return;
      }
      setAplicandoSugestoes(true);
      if (!auto) {
        setErr('');
        setMsgOk('');
      }
      let aplicadas = 0;
      let falhas = 0;
      for (const { id, sug } of pendentes) {
        sugestoesAutoTentadasRef.current.add(String(id));
        try {
          const v = await vincularPublicacaoProcessoPorChaveNatural(
            id,
            sug.codCliente,
            sug.procInterno,
            'Vínculo automático pela sugestão de cadastro (CNJ).'
          );
          if (v == null) falhas += 1;
          else aplicadas += 1;
        } catch {
          falhas += 1;
        }
      }
      if (aplicadas > 0) {
        await carregar();
      }
      setAplicandoSugestoes(false);
      if (aplicadas > 0 || !auto) {
        const partes = [];
        if (aplicadas > 0) partes.push(`${aplicadas} vínculo(s) aplicado(s) automaticamente`);
        if (falhas > 0) partes.push(`${falhas} não aplicável(is) (confira manualmente)`);
        setMsgOk(partes.join(' · ') || 'Nenhuma sugestão aplicável.');
      }
    },
    [coletarSugestoesAplicaveis, carregar]
  );

  useEffect(() => {
    if (!cfg.autoAplicarSugestoes || carregandoSugestoes || aplicandoSugestoes || !rows.length) {
      return;
    }
    void aplicarTodasSugestoes({ auto: true });
  }, [cfg.autoAplicarSugestoes, carregandoSugestoes, aplicandoSugestoes, rows, indiceCnj, sugestoesApi, aplicarTodasSugestoes]);

  const handleAplicarVinculoPublicacao = async ({ codCliente, proc }) => {
    const row = rows.find((x) => x.id === vinculoModal?.id);
    if (!row) return;
    const cod = normalizarCodigoClienteFinanceiro(codCliente);
    const procNorm = normalizarProcFinanceiro(proc);
    if (!cod) {
      setErr('Selecione um cliente com código válido.');
      return;
    }
    if (!procNorm) {
      setErr('Selecione um processo com número interno válido.');
      return;
    }
    setVinculoModal(null);
    setErr('');
    setMsgOk('');
    try {
      const vinculado = await vincularPublicacaoProcessoPorChaveNatural(
        row._apiId ?? row.id,
        cod,
        procNorm,
        'Vínculo manual via tela de publicações por email.'
      );
      if (vinculado == null) {
        setErr('Não foi possível resolver processo por código/proc. interno.');
        return;
      }
      setMsgOk('Vínculo salvo com sucesso.');
      await carregar();
    } catch (e) {
      setErr(mensagemErroAmigavel(e, 'vincular a publicação'));
    }
  };

  const reaplicarVinculoAuto = async (row) => {
    setErr('');
    setMsgOk('');
    const pubId = row._apiId ?? row.id;
    try {
      await vincularPublicacaoProcessoAutomatico(
        pubId,
        'Vínculo automático por CNJ (processo cadastrado no sistema).'
      );
      setMsgOk('Vínculo automático aplicado ao processo existente no cadastro.');
      await carregar();
      return;
    } catch (eApi) {
      const resHit = buscarHitIndiceCnjPorCnj(indiceCnj, cnjLinha(row));
      const hit = resHit?.hit;
      if (!hit) {
        setErr(
          eApi?.message ||
            'Nenhum processo cadastrado com este CNJ. Cadastre o processo em Processos ou vincule manualmente.'
        );
        return;
      }
      try {
        const v = await vincularPublicacaoProcessoPorChaveNatural(
          pubId,
          hit.codCliente,
          hit.proc,
          'Vínculo automático pelo índice CNJ (cadastro).'
        );
        if (v == null) {
          setErr('Não foi possível vincular automaticamente na API.');
          return;
        }
        setMsgOk('Vínculo automático aplicado.');
        await carregar();
      } catch (e2) {
        setErr(mensagemErroAmigavel(e2, 'reaplicar o vínculo automático'));
      }
    }
  };

  const abrirProcesso = (row) => {
    const state = construirStateProcessosDesdeLinha(row, indiceCnj, sugestoesApi);
    if (state) navigate('/processos', { state });
  };

  const abrirFormularioProcessoFlutuante = useCallback(
    (row) => {
      const st = construirStateProcessosDesdeLinha(row, indiceCnj, sugestoesApi);
      if (!st) return;
      setProcessoEmbed({ revision: Date.now(), routerState: st });
    },
    [indiceCnj, sugestoesApi]
  );

  const toggleLinha = (row) => {
    if (window.matchMedia('(min-width: 768px)').matches) {
      setModalPublicacao(row);
      return;
    }
    setExpandidoId((prev) => (prev === row.id ? null : row.id));
  };

  const toggleOrdemDataPublicacao = (e) => {
    e.preventDefault();
    setOrdemDataAsc((v) => !v);
  };

  const acoesProps = (row) => ({
    onVincular: () => abrirVinculoModal(row),
    onAuto: () => void reaplicarVinculoAuto(row),
    onTratar: () => void alterarStatus(row, 'TRATADA'),
    onIgnorar: () => void alterarStatus(row, 'IGNORADA'),
    onMarcarVinculada: () => void alterarStatus(row, 'VINCULADA'),
  });

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-100 via-sky-50/35 to-indigo-50/40 text-slate-900 dark:bg-gradient-to-b dark:from-[#0a0d12] dark:via-[#0c1017] dark:to-[#0e141d] dark:text-slate-100">
      <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6">
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => navigate(cfg.voltarPara)}
            className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            {cfg.voltarLabel}
          </button>
          <div className="flex items-center gap-2">
            <Mail className="h-6 w-6 text-sky-600 dark:text-sky-400" />
            <h1 className="text-xl font-bold">{cfg.titulo}</h1>
          </div>
          <span className="hidden text-xs text-slate-500 dark:text-slate-400 sm:inline">
            {cfg.remetente}
          </span>
          <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{totalLabel}</span>
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#141922]">
          <button
            type="button"
            onClick={() => void handleProcessar(false)}
            disabled={processando || processandoCompleto}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60"
          >
            {processando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Buscar emails novos
          </button>
          <button
            type="button"
            onClick={() => void handleProcessar(true)}
            disabled={processando || processandoCompleto}
            title="Varre toda a caixa do remetente e reprocessa emails já importados"
            className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-60 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-100 dark:hover:bg-amber-950/50"
          >
            {processandoCompleto ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            Forçar atualização completa
          </button>
          <button
            type="button"
            onClick={carregar}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:bg-white/5 dark:text-slate-200"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Atualizar lista
          </button>
          <p className="w-full text-xs text-slate-500 dark:text-slate-400">
            Última busca no Gmail: {fmtInstant(ultimaSyncGmail)}
            {ultimaSyncGmail
              ? ' — buscas normais consideram apenas emails recebidos após esse momento.'
              : ' — na primeira busca incremental, o sistema usa os últimos 30 dias.'}
          </p>
        </div>

        {resultadoProcessamento ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm dark:border-emerald-900/50 dark:bg-emerald-950/30">
            <p className="font-medium text-emerald-900 dark:text-emerald-100">Processamento concluído</p>
            <ul className="mt-2 space-y-1 text-emerald-800 dark:text-emerald-200">
              <li>
                Modo:{' '}
                {resultadoProcessamento.forcarAtualizacao
                  ? 'atualização completa (toda a caixa)'
                  : 'incremental (desde última busca)'}
              </li>
              {resultadoProcessamento.ultimaSincronizacaoGravada ? (
                <li>
                  Cursor Gmail gravado: {fmtInstant(resultadoProcessamento.ultimaSincronizacaoGravada)}
                </li>
              ) : null}
              <li>Emails lidos: {resultadoProcessamento.emailsLidos ?? 0}</li>
              <li>Publicações encontradas: {resultadoProcessamento.publicacoesEncontradas ?? 0}</li>
              <li>Processos únicos: {resultadoProcessamento.processosUnicos ?? 0}</li>
              <li>Publicações gravadas: {resultadoProcessamento.publicacoesProcessadas ?? 0}</li>
              <li>Duplicadas ignoradas: {resultadoProcessamento.publicacoesDuplicadasIgnoradas ?? 0}</li>
              <li>Vínculos automáticos (CNJ): {resultadoProcessamento.vinculosAutomaticos ?? 0}</li>
              <li>Erros: {(resultadoProcessamento.erros || []).length}</li>
            </ul>
          </div>
        ) : null}

        {msgOk ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
            {msgOk}
          </div>
        ) : null}

        {err ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
            {err}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#141922]">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={buscaTexto}
              onChange={(e) => setBuscaTexto(e.target.value)}
              placeholder={cfg.placeholderBusca}
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm dark:border-white/15 dark:bg-white/5"
            />
          </div>
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-white/5"
          >
            {STATUS_OPCOES.map((op) => (
              <option key={op.value || 'todos'} value={op.value}>
                {op.label}
              </option>
            ))}
          </select>
          <select
            value={filtroVinculo}
            onChange={(e) => setFiltroVinculo(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-white/5"
          >
            {VINCULO_FILTRO_OPCOES.map((op) => (
              <option key={op.value} value={op.value}>
                {op.label}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Carregando publicações…
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white/60 px-6 py-16 text-center text-sm text-slate-500 dark:border-white/15 dark:bg-white/5">
            {cfg.vazio}
          </div>
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {rowsExibidas.map((row) => (
                <CardMobileRow
                  key={row.id}
                  row={row}
                  indiceCnj={indiceCnj}
                  sugestoesApi={sugestoesApi}
                  carregandoSugestoes={carregandoSugestoes}
                  expandido={expandidoId === row.id}
                  onToggle={() => toggleLinha(row)}
                  onAbrirProcesso={() => abrirProcesso(row)}
                  onAplicarSugestao={() => void aplicarSugestaoVinculo(row)}
                  isProjudi={isProjudi}
                  teorDaLinha={teorDaLinha}
                  {...acoesProps(row)}
                />
              ))}
            </div>
            <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#141922] md:block">
              <table className="w-full min-w-[1180px] text-xs">
                <thead className="bg-slate-50 text-left text-slate-600 dark:bg-white/5 dark:text-slate-400">
                  <tr>
                    <th
                      className="cursor-pointer select-none whitespace-nowrap px-3 py-2.5 font-medium hover:bg-slate-100/80 dark:hover:bg-white/10"
                      onDoubleClick={toggleOrdemDataPublicacao}
                    >
                      Data
                      <span className="ml-1 text-[10px] opacity-70" title="Duplo clique para inverter ordem">
                        {ordemDataAsc ? '↑' : '↓'}
                      </span>
                    </th>
                    {isProjudi ? (
                      <th className="min-w-[140px] px-3 py-2.5 font-medium">Tipo movimento</th>
                    ) : null}
                    <th className="w-[108px] max-w-[108px] px-2 py-2.5 font-medium">Nº processo</th>
                    <th className="min-w-[140px] px-3 py-2.5 font-medium">Código / proc.</th>
                    {isProjudi ? (
                      <th className="min-w-[200px] px-3 py-2.5 font-medium">Partes (cliente × réu)</th>
                    ) : (
                      <th className="min-w-[220px] px-3 py-2.5 font-medium">Teor</th>
                    )}
                    <th className="w-[96px] max-w-[96px] px-2 py-2.5 font-medium">Vínculo</th>
                    {!isProjudi ? (
                      <th className="min-w-[160px] px-3 py-2.5 font-medium">Origem / Email</th>
                    ) : null}
                    <th className="whitespace-nowrap px-3 py-2.5 font-medium">Recebimento</th>
                    <th className="w-[120px] px-3 py-2.5 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                  {rowsExibidas.map((row) => {
                    const destaque =
                      row.statusVinculo === 'nao_vinculado' || row.statusVinculo === 'sem_cnj'
                        ? 'border-l-2 border-l-amber-400/80'
                        : '';
                    return (
                      <tr
                        key={row.id}
                        className={`align-top hover:bg-slate-50/80 dark:hover:bg-white/5 ${destaque}`}
                      >
                        <td
                          className="cursor-pointer whitespace-nowrap px-3 py-2.5"
                          onClick={() => toggleLinha(row)}
                          title="Ver detalhes"
                        >
                          {fmtDataBr(row.dataPublicacao)}
                        </td>
                        {isProjudi ? (
                          <td
                            className="max-w-[180px] cursor-pointer px-3 py-2.5 font-medium text-violet-900 dark:text-violet-200"
                            onClick={() => toggleLinha(row)}
                            title={tipoMovimentoLinha(row)}
                          >
                            {truncarTeor(tipoMovimentoLinha(row), 80)}
                          </td>
                        ) : null}
                        <td
                          className="max-w-[108px] cursor-pointer truncate px-2 py-2.5 font-mono text-[10px] text-sky-800 dark:text-sky-300"
                          onClick={() => toggleLinha(row)}
                          title={cnjLinha(row)}
                        >
                          <span className="inline-flex max-w-full items-center">
                            <span className="truncate">{cnjLinha(row)}</span>
                            <BadgeNoDrive row={row} />
                          </span>
                        </td>
                        <td className="max-w-[160px] px-3 py-2.5">
                          <CelulaClienteProc row={row} indiceCnj={indiceCnj} sugestoesApi={sugestoesApi} />
                        </td>
                        {isProjudi ? (
                          <td
                            className="max-w-[240px] cursor-pointer px-3 py-2.5 text-slate-700 dark:text-slate-300"
                            onClick={() => toggleLinha(row)}
                            title={formatarPartesLinha(row)}
                          >
                            {truncarTeor(formatarPartesLinha(row), 100)}
                          </td>
                        ) : (
                          <td
                            className="cursor-pointer px-3 py-2.5 text-slate-700 dark:text-slate-300"
                            onClick={() => toggleLinha(row)}
                            title={teorDaLinha(row)}
                          >
                            {truncarTeor(teorDaLinha(row), 120)}
                          </td>
                        )}
                        <td className="max-w-[96px] px-2 py-2.5">
                          <CelulaVinculo
                            row={row}
                            indiceCnj={indiceCnj}
                            sugestoesApi={sugestoesApi}
                            carregandoSugestoes={carregandoSugestoes}
                            onAbrirProcesso={() => abrirProcesso(row)}
                            onAplicarSugestao={() => void aplicarSugestaoVinculo(row)}
                          />
                        </td>
                        {!isProjudi ? (
                          <td
                            className="max-w-[200px] truncate px-3 py-2.5 text-slate-600 dark:text-slate-400"
                            title={row.arquivoOrigem}
                          >
                            {row.arquivoOrigem || '—'}
                          </td>
                        ) : null}
                        <td className="whitespace-nowrap px-3 py-2.5 text-slate-600 dark:text-slate-400">
                          {fmtInstant(row.emailRecebidoEm)}
                        </td>
                        <td className="px-3 py-2.5">
                          <AcoesLinha {...acoesProps(row)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {modalPublicacao ? (
        <ModalTeor
          publicacao={modalPublicacao}
          onClose={() => setModalPublicacao(null)}
          onAbrirProcesso={() => abrirFormularioProcessoFlutuante(modalPublicacao)}
          isProjudi={isProjudi}
        />
      ) : null}
      {processoEmbed ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-2 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="publicacoes-email-processo-embed-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setProcessoEmbed(null);
          }}
        >
          <div
            className="flex h-[min(100dvh-0.5rem,920px)] max-h-[min(100dvh-0.5rem,920px)] min-h-0 w-[min(100vw-0.5rem,1280px)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0f141c]"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 dark:border-white/10 dark:bg-[#141c2c]">
              <h2
                id="publicacoes-email-processo-embed-title"
                className="text-sm font-semibold text-slate-900 dark:text-white"
              >
                Processo (cadastro)
              </h2>
              <button
                type="button"
                onClick={() => setProcessoEmbed(null)}
                className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-white/10"
                aria-label="Fechar formulário de processo"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
              <Suspense
                fallback={
                  <div className="flex min-h-[12rem] items-center justify-center p-8 text-sm text-slate-600 dark:text-slate-400">
                    Carregando formulário de processos…
                  </div>
                }
              >
                <ProcessosLazy
                  key={processoEmbed.revision}
                  embedIntent={processoEmbed.routerState}
                  embedIntentRevision={processoEmbed.revision}
                  onFecharEmbed={() => setProcessoEmbed(null)}
                />
              </Suspense>
            </div>
          </div>
        </div>
      ) : null}
      <ModalVinculoClienteProcFinanceiro
        aberto={Boolean(vinculoModal)}
        onFechar={() => setVinculoModal(null)}
        resumoLancamento={vinculoModal?.resumo ?? ''}
        onAplicar={handleAplicarVinculoPublicacao}
        modoContaEscritorio
        titulo="Vincular ao cadastro interno"
      />
    </div>
  );
}
