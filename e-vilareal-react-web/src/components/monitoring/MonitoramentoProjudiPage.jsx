import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BellOff,
  CheckCircle2,
  EyeOff,
  FilePlus2,
  History,
  Inbox,
  Loader2,
  Lock,
  MessageCircle,
  RefreshCw,
  UserSearch,
} from 'lucide-react';
import {
  listarPessoasMonitoradas,
  listarDescobertos,
  listarDescobertosDaPessoa,
  listarSegredoDaPessoa,
  ignorarDescoberto,
  cadastrarDescoberto,
  obterContextoAviso,
  avisarCliente,
  listarVarreduras,
} from '../../api/monitoramentoService.js';

/** Filtros da caixa de entrada: rótulo amigável → parâmetro do backend. Nunca expõe o enum cru. */
const FILTROS_SITUACAO = [
  { valor: 'NOVO', rotulo: 'Alertas' },
  { valor: 'BASELINE', rotulo: 'Histórico da varredura inicial' },
  { valor: 'VINCULADO', rotulo: 'Já no acervo' },
  { valor: 'IGNORADO', rotulo: 'Ignorados' },
];

const CORES_ROTULO = {
  Alerta: 'bg-amber-100 text-amber-800 border-amber-300',
  'No seu acervo': 'bg-emerald-100 text-emerald-800 border-emerald-300',
  'Histórico (não cadastrado)': 'bg-slate-100 text-slate-600 border-slate-300',
  Ignorado: 'bg-slate-100 text-slate-500 border-slate-300',
};

const ROTULOS_POLO = {
  ATIVO: 'Pessoa no polo ativo',
  PASSIVO: 'Pessoa no polo passivo',
  AMBOS: 'Pessoa nos dois polos',
  INDETERMINADO: 'Polo não identificado',
};

function fmtData(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('pt-BR');
  } catch {
    return iso;
  }
}

function fmtDataHora(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR');
  } catch {
    return iso;
  }
}

function fmtCpfCnpj(digitos) {
  const d = String(digitos ?? '').replace(/\D/g, '');
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return digitos || '—';
}

function RotuloBadge({ rotulo }) {
  const cor = CORES_ROTULO[rotulo] || 'bg-slate-100 text-slate-600 border-slate-300';
  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full border ${cor}`}>
      {rotulo}
    </span>
  );
}

/**
 * Card de um processo descoberto. CLASSE, PARTES e CNJ em destaque: é a última chance de o
 * usuário perceber "isso é um recurso de algo que já tenho" antes de cadastrar.
 */
function CardDescoberto({ d, mostrarPessoa, onCadastrar, onAvisar, onIgnorar, busyId }) {
  const busy = busyId === d.id;
  const ehAlerta = d.rotulo === 'Alerta';
  const jaNoAcervo = d.processoId != null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <RotuloBadge rotulo={d.rotulo} />
            {mostrarPessoa && d.pessoa ? (
              <span className="text-xs text-slate-500">{d.pessoa.nome}</span>
            ) : null}
          </div>
          <div className="mt-1 font-mono text-base font-semibold text-slate-800">
            {d.numeroCnj || `${d.numeroReduzido}/${d.anoDistribuicao} (número reduzido)`}
          </div>
          {d.classe ? (
            <div className="mt-0.5 text-sm font-semibold text-blue-800">{d.classe}</div>
          ) : (
            <div className="mt-0.5 text-sm text-slate-400 italic">
              Classe ainda não colhida (será consultada no PROJUDI ao cadastrar)
            </div>
          )}
        </div>
        <div className="text-right text-xs text-slate-500 shrink-0">
          <div>Distribuído em {fmtData(d.dataDistribuicao)}</div>
          <div className="mt-0.5">{ROTULOS_POLO[d.poloDaPessoa] || d.poloDaPessoa}</div>
        </div>
      </div>

      <div className="mt-2 grid sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <div>
          <span className="text-xs uppercase tracking-wide text-slate-400">Polo ativo</span>
          <div className="text-slate-800 font-medium">{d.partesAtivo || '—'}</div>
        </div>
        <div>
          <span className="text-xs uppercase tracking-wide text-slate-400">Polo passivo</span>
          <div className="text-slate-800 font-medium">{d.partesPassivo || '—'}</div>
        </div>
      </div>
      {d.serventia ? <div className="mt-1 text-xs text-slate-500">{d.serventia}</div> : null}

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        {jaNoAcervo ? (
          <span className="inline-flex items-center gap-1 text-sm text-emerald-700">
            <CheckCircle2 className="w-4 h-4" /> No acervo (processo #{d.processoId})
          </span>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onCadastrar(d)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FilePlus2 className="w-4 h-4" />}
              Cadastrar processo
            </button>
            <button
              type="button"
              onClick={() => onAvisar(d)}
              disabled={busy}
              title="Aviso via WhatsApp — exige consentimento registrado no cadastro da pessoa"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-emerald-500 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
            >
              <MessageCircle className="w-4 h-4" />
              Avisar cliente
            </button>
            {ehAlerta ? (
              <button
                type="button"
                onClick={() => onIgnorar(d)}
                disabled={busy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              >
                <EyeOff className="w-4 h-4" />
                Ignorar
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Modal de cadastro em duas fases (Bloco C):
 * fase 1 (POST sem corpo) traz candidatos + sugestão; fase 2 confirma com clienteId+numeroInterno.
 * Se a anti-duplicata pegar (JA_CADASTRADO), mostra "já está no seu acervo" — nunca finge criar.
 */
function ModalCadastro({ descoberto, onFechar, onConcluido }) {
  const [fase, setFase] = useState('carregando'); // carregando | confirmar | resultado | erro
  const [resposta, setResposta] = useState(null);
  const [clienteId, setClienteId] = useState(null);
  const [numeroInterno, setNumeroInterno] = useState('');
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');
  const dados = resposta?.descoberto || descoberto;

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const r = await cadastrarDescoberto(descoberto.id);
        if (!ativo) return;
        setResposta(r);
        if (r.resultado === 'PENDENTE_CONFIRMACAO') {
          const candidatos = r.clientesCandidatos || [];
          // Um único candidato pode ser pré-selecionado; vários FORÇAM escolha explícita.
          setClienteId(candidatos.length === 1 ? candidatos[0].id : null);
          setNumeroInterno(r.numeroInternoSugerido != null ? String(r.numeroInternoSugerido) : '');
          setFase('confirmar');
        } else {
          setFase('resultado');
        }
      } catch (e) {
        if (!ativo) return;
        setErro(e.message || 'Falha ao consultar o cadastro.');
        setFase('erro');
      }
    })();
    return () => {
      ativo = false;
    };
  }, [descoberto.id]);

  const confirmar = async () => {
    setBusy(true);
    setErro('');
    try {
      const r = await cadastrarDescoberto(descoberto.id, {
        clienteId,
        numeroInterno: Number(numeroInterno),
      });
      setResposta(r);
      setFase('resultado');
      onConcluido();
    } catch (e) {
      setErro(e.message || 'Falha ao cadastrar.');
    } finally {
      setBusy(false);
    }
  };

  const candidatos = resposta?.clientesCandidatos || [];
  const varios = candidatos.length > 1;
  const podeConfirmar = clienteId != null && String(numeroInterno).trim() !== '' && !busy;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800">Cadastrar processo no acervo</h3>
          <p className="text-sm text-slate-500">
            Revise antes de confirmar — o cadastro nunca é automático.
          </p>
        </div>

        <div className="p-5 space-y-4">
          {fase === 'carregando' ? (
            <div className="flex items-center gap-3 text-slate-600 py-6 justify-center">
              <Loader2 className="w-5 h-5 animate-spin" />
              Consultando… (pode abrir o detalhe no PROJUDI para colher CNJ/classe)
            </div>
          ) : null}

          {fase !== 'carregando' && dados ? (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 space-y-1.5">
              <div className="font-mono text-base font-bold text-slate-900">
                {dados.numeroCnj || `${dados.numeroReduzido}/${dados.anoDistribuicao}`}
              </div>
              {dados.classe ? (
                <div className="text-sm font-bold text-blue-900">{dados.classe}</div>
              ) : null}
              <div className="grid sm:grid-cols-2 gap-x-3 text-sm">
                <div>
                  <span className="text-xs uppercase text-slate-500">Polo ativo</span>
                  <div className="font-semibold text-slate-800">{dados.partesAtivo || '—'}</div>
                </div>
                <div>
                  <span className="text-xs uppercase text-slate-500">Polo passivo</span>
                  <div className="font-semibold text-slate-800">{dados.partesPassivo || '—'}</div>
                </div>
              </div>
              <div className="text-xs text-slate-600">
                {dados.serventia || 'Serventia não colhida'} · Distribuído em {fmtData(dados.dataDistribuicao)}
              </div>
            </div>
          ) : null}

          {fase === 'confirmar' ? (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Cliente {varios ? '— a pessoa tem mais de um cadastro, escolha em qual registrar' : ''}
                </label>
                {candidatos.length === 0 ? (
                  <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2">
                    {resposta?.mensagem || 'A pessoa não tem cadastro de cliente.'}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {candidatos.map((c) => (
                      <label
                        key={c.id}
                        className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer ${
                          clienteId === c.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200'
                        }`}
                      >
                        <input
                          type="radio"
                          name="clienteCandidato"
                          checked={clienteId === c.id}
                          onChange={() => setClienteId(c.id)}
                        />
                        <span className="text-sm text-slate-800">{c.rotulo || c.codigoCliente || `Cliente ${c.id}`}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Número interno {resposta?.numeroInternoSugerido != null
                    ? `(sugestão: ${resposta.numeroInternoSugerido})`
                    : '(cliente sem sequência — preencha manualmente)'}
                </label>
                <input
                  type="number"
                  min="1"
                  value={numeroInterno}
                  onChange={(e) => setNumeroInterno(e.target.value)}
                  className="w-40 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              {erro ? (
                <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2">{erro}</div>
              ) : null}
            </>
          ) : null}

          {fase === 'resultado' && resposta ? (
            resposta.resultado === 'JA_CADASTRADO' ? (
              <div className="flex items-start gap-2 text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm">
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <strong>Já está no seu acervo</strong>
                  {resposta.numeroInterno != null ? ` como numeroInterno ${resposta.numeroInterno}` : ''}
                  {resposta.processoId != null ? ` (processo #${resposta.processoId})` : ''}.
                  <div className="text-emerald-700 mt-0.5">Nenhum processo novo foi criado — o alerta foi vinculado ao existente.</div>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2 text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm">
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <strong>Processo cadastrado</strong> (numeroInterno {resposta.numeroInterno}, processo #{resposta.processoId}).
                </div>
              </div>
            )
          ) : null}

          {fase === 'erro' ? (
            <div className="flex items-start gap-2 text-rose-800 bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>{erro}</div>
            </div>
          ) : null}
        </div>

        <div className="p-4 border-t border-slate-200 flex justify-end gap-2">
          <button
            type="button"
            onClick={onFechar}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100"
          >
            {fase === 'resultado' ? 'Fechar' : 'Cancelar'}
          </button>
          {fase === 'confirmar' ? (
            <button
              type="button"
              onClick={confirmar}
              disabled={!podeConfirmar}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FilePlus2 className="w-4 h-4" />}
              Confirmar cadastro
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * Modal do aviso WhatsApp (Bloco E). O envio real só acontece no clique em "Enviar", e o
 * BACKEND recusa sem consentimento (403) — os bloqueios exibidos aqui são espelho, não a trava.
 * O corpo do template é fixo (aprovado pela Meta); o que se edita são as 4 variáveis.
 */
function ModalAviso({ descoberto, onFechar, onConcluido }) {
  const [fase, setFase] = useState('carregando'); // carregando | pronto | enviado | erro
  const [ctx, setCtx] = useState(null);
  const [telefone, setTelefone] = useState('');
  const [parametros, setParametros] = useState([]);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const c = await obterContextoAviso(descoberto.id);
        if (!ativo) return;
        setCtx(c);
        setTelefone(c.telefones?.[0]?.numero || '');
        setParametros(c.parametrosSugeridos || []);
        setFase('pronto');
      } catch (e) {
        if (!ativo) return;
        setErro(e.message || 'Falha ao carregar o contexto do aviso.');
        setFase('erro');
      }
    })();
    return () => {
      ativo = false;
    };
  }, [descoberto.id]);

  const bloqueio = !ctx
    ? null
    : !ctx.consentimento
      ? {
          tom: 'rose',
          texto:
            'A pessoa não registrou consentimento para receber aviso de processo novo. ' +
            'Registre o consentimento no cadastro da pessoa antes de enviar — o backend recusa o envio sem ele.',
        }
      : ctx.avisoEnviadoEm
        ? {
            tom: 'emerald',
            texto: `Aviso já enviado em ${fmtDataHora(ctx.avisoEnviadoEm)} para ${ctx.avisoEnviadoPara}. Reenvio bloqueado.`,
          }
        : (ctx.telefones || []).length === 0
          ? { tom: 'rose', texto: 'Sem WhatsApp cadastrado para esta pessoa/cliente.' }
          : !ctx.templateAprovado
            ? {
                tom: 'amber',
                texto:
                  ctx.templateStatus === 'INDISPONIVEL'
                    ? 'Não foi possível verificar o status do template na Meta — envio bloqueado por segurança.'
                    : `Template "aviso_novo_processo" pendente de aprovação na Meta (status: ${ctx.templateStatus}). O envio será liberado após a aprovação.`,
              }
            : null;

  const previa = useMemo(() => {
    if (!ctx) return '';
    let corpo = ctx.corpoTemplate || '';
    parametros.forEach((p, i) => {
      corpo = corpo.replaceAll(`{{${i + 1}}}`, p || `{{${i + 1}}}`);
    });
    return corpo;
  }, [ctx, parametros]);

  const enviar = async () => {
    setBusy(true);
    setErro('');
    try {
      await avisarCliente(descoberto.id, { telefone, parametros });
      setFase('enviado');
      onConcluido();
    } catch (e) {
      setErro(e.message || 'Falha ao enviar o aviso.');
    } finally {
      setBusy(false);
    }
  };

  const cores = {
    rose: 'text-rose-800 bg-rose-50 border-rose-200',
    amber: 'text-amber-900 bg-amber-50 border-amber-300',
    emerald: 'text-emerald-800 bg-emerald-50 border-emerald-200',
  };
  const rotulosParametros = ['Nome do cliente', 'Número do processo', 'Vara/serventia', 'Escritório'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800">Avisar cliente por WhatsApp</h3>
          <p className="text-sm text-slate-500">
            Um cliente, um clique, uma revisão — o envio só acontece no botão "Enviar".
          </p>
        </div>

        <div className="p-5 space-y-4">
          {fase === 'carregando' ? (
            <div className="flex items-center gap-3 text-slate-600 py-6 justify-center">
              <Loader2 className="w-5 h-5 animate-spin" /> Verificando consentimento, telefone e template…
            </div>
          ) : null}

          {fase === 'erro' ? (
            <div className={`border rounded-lg p-3 text-sm ${cores.rose}`}>{erro}</div>
          ) : null}

          {fase === 'enviado' ? (
            <div className={`flex items-start gap-2 border rounded-lg p-3 text-sm ${cores.emerald}`}>
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <strong>Aviso enviado</strong> para {telefone}. O envio ficou registrado — este
                processo não gera segundo aviso.
              </div>
            </div>
          ) : null}

          {fase === 'pronto' && bloqueio ? (
            <div className={`flex items-start gap-2 border rounded-lg p-3 text-sm ${cores[bloqueio.tom]}`}>
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>{bloqueio.texto}</div>
            </div>
          ) : null}

          {fase === 'pronto' && !bloqueio ? (
            <>
              <div className={`text-xs border rounded-lg p-2 ${cores.emerald}`}>
                Consentimento registrado em {fmtDataHora(ctx.consentimentoEm)} ({ctx.consentimentoOrigem}).
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Enviar para</label>
                <select
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  {(ctx.telefones || []).map((t) => (
                    <option key={t.numero} value={t.numero}>
                      {t.numero} — {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {parametros.map((p, i) => (
                  <div key={i}>
                    <label className="block text-xs text-slate-500 mb-0.5">{rotulosParametros[i] || `Variável ${i + 1}`}</label>
                    <input
                      value={p}
                      onChange={(e) =>
                        setParametros((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))
                      }
                      className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Prévia da mensagem (corpo fixo do template aprovado; edite as variáveis acima)
                </label>
                <div className="border border-slate-200 bg-slate-50 rounded-lg p-3 text-sm text-slate-800 whitespace-pre-wrap">
                  {previa}
                </div>
              </div>
              {erro ? <div className={`border rounded-lg p-2 text-sm ${cores.rose}`}>{erro}</div> : null}
            </>
          ) : null}
        </div>

        <div className="p-4 border-t border-slate-200 flex justify-end gap-2">
          <button
            type="button"
            onClick={onFechar}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100"
          >
            {fase === 'enviado' ? 'Fechar' : 'Cancelar'}
          </button>
          {fase === 'pronto' && !bloqueio ? (
            <button
              type="button"
              onClick={enviar}
              disabled={busy || !telefone || parametros.some((p) => !String(p).trim())}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
              Enviar
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Painel de uma pessoa: alertas, recentes já existentes (30 dias), lista filtrável e segredo. */
function PainelPessoa({ pessoa, onVoltar, onCadastrar, onAvisar, onIgnorar, busyId, revisao }) {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [alertas, setAlertas] = useState([]);
  const [recentesExistentes, setRecentesExistentes] = useState([]);
  const [segredo, setSegredo] = useState([]);
  const [todos, setTodos] = useState([]);
  const [filtro, setFiltro] = useState('');

  useEffect(() => {
    let ativo = true;
    (async () => {
      setCarregando(true);
      setErro('');
      try {
        const [nv, rec, seg, tds] = await Promise.all([
          listarDescobertosDaPessoa(pessoa.id, { situacao: 'NOVO' }),
          listarDescobertosDaPessoa(pessoa.id, { recentes: true }),
          listarSegredoDaPessoa(pessoa.id),
          listarDescobertosDaPessoa(pessoa.id, {}),
        ]);
        if (!ativo) return;
        setAlertas(nv);
        // "Recentes já existentes": distribuídos nos últimos 30 dias E já no acervo — SEPARADO dos alertas.
        setRecentesExistentes(rec.filter((d) => d.processoId != null));
        setSegredo(seg);
        setTodos(tds);
      } catch (e) {
        if (ativo) setErro(e.message || 'Falha ao carregar o painel da pessoa.');
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [pessoa.id, revisao]);

  const filtrados = useMemo(
    () => (filtro ? todos.filter((d) => d.situacao === filtro) : todos),
    [todos, filtro],
  );
  const totalSegredo = segredo.reduce((s, e) => s + (e.qtd || 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={onVoltar}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <div>
          <h2 className="text-lg font-semibold text-slate-800">{pessoa.nome}</h2>
          <div className="text-xs text-slate-500">
            {fmtCpfCnpj(pessoa.cpf)} · Polo monitorado: {pessoa.poloMonitorado === 'AMBOS' ? 'ambos' : pessoa.poloMonitorado?.toLowerCase()} ·{' '}
            {pessoa.baselineEm
              ? `varredura inicial concluída em ${fmtDataHora(pessoa.baselineEm)}`
              : 'varredura inicial ainda não concluída'}
          </div>
        </div>
      </div>

      {erro ? (
        <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">{erro}</div>
      ) : null}
      {carregando ? (
        <div className="flex items-center gap-2 text-slate-500 py-8 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" /> Carregando…
        </div>
      ) : (
        <>
          {totalSegredo > 0 ? (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-300 rounded-xl p-3 text-sm text-amber-900">
              <Lock className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <strong>{totalSegredo} processo{totalSegredo !== 1 ? 's' : ''} em segredo de justiça.</strong>{' '}
                Processos em segredo não são acessíveis pela varredura; verifique presencialmente na serventia.
                <ul className="mt-1 list-disc list-inside text-amber-800">
                  {segredo.map((s) => (
                    <li key={s.serventia}>
                      {s.serventia}: {s.qtd}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}

          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-2">
              Alertas — processos novos ({alertas.length})
            </h3>
            {alertas.length === 0 ? (
              <div className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-4">
                Nenhum processo novo desde a última varredura.
              </div>
            ) : (
              <div className="space-y-3">
                {alertas.map((d) => (
                  <CardDescoberto key={d.id} d={d} onCadastrar={onCadastrar} onAvisar={onAvisar} onIgnorar={onIgnorar} busyId={busyId} />
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-2">
              Recentes já existentes — distribuídos nos últimos 30 dias e já no acervo ({recentesExistentes.length})
            </h3>
            {recentesExistentes.length === 0 ? (
              <div className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-4">
                Nenhum processo do acervo distribuído nos últimos 30 dias.
              </div>
            ) : (
              <div className="space-y-3">
                {recentesExistentes.map((d) => (
                  <CardDescoberto key={d.id} d={d} onCadastrar={onCadastrar} onAvisar={onAvisar} onIgnorar={onIgnorar} busyId={busyId} />
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Todos os descobertos ({filtrados.length})
              </h3>
              <select
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                className="px-2 py-1.5 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="">Todos</option>
                {FILTROS_SITUACAO.map((f) => (
                  <option key={f.valor} value={f.valor}>
                    {f.rotulo}
                  </option>
                ))}
              </select>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
              {filtrados.map((d) => (
                <div key={d.id} className="px-3 py-2 flex items-center gap-3 text-sm">
                  <RotuloBadge rotulo={d.rotulo} />
                  <span className="font-mono text-slate-800">
                    {d.numeroCnj || `${d.numeroReduzido}/${d.anoDistribuicao}`}
                  </span>
                  <span className="text-slate-500 text-xs">{fmtData(d.dataDistribuicao)}</span>
                  <span className="text-slate-500 text-xs truncate flex-1">
                    {d.classe || d.partesAtivo || ''}
                  </span>
                </div>
              ))}
              {filtrados.length === 0 ? (
                <div className="px-3 py-4 text-sm text-slate-500">Nada nesta categoria.</div>
              ) : null}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

const ROTULOS_STATUS_VARREDURA = {
  EXECUTANDO: { rotulo: 'Em execução', cor: 'bg-blue-100 text-blue-800 border-blue-300' },
  SUCESSO: { rotulo: 'Concluída', cor: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  PARCIAL: { rotulo: 'Parcial (continua)', cor: 'bg-amber-100 text-amber-800 border-amber-300' },
  ERRO: { rotulo: 'Erro', cor: 'bg-rose-100 text-rose-800 border-rose-300' },
};

function StatusVarreduraBadge({ status }) {
  const s = ROTULOS_STATUS_VARREDURA[status] || {
    rotulo: status || '—',
    cor: 'bg-slate-100 text-slate-600 border-slate-300',
  };
  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full border ${s.cor}`}>
      {s.rotulo}
    </span>
  );
}

function fmtDuracao(segundos) {
  if (segundos == null) return '—';
  if (segundos < 60) return `${segundos}s`;
  return `${Math.floor(segundos / 60)}min ${segundos % 60}s`;
}

/** Histórico de varreduras para conferência: quando rodou, para quem, resultado e erros. */
function ModalHistoricoVarreduras({ pessoas, onFechar }) {
  const [varreduras, setVarreduras] = useState([]);
  const [filtroPessoaId, setFiltroPessoaId] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro('');
    (async () => {
      try {
        const lista = await listarVarreduras({
          pessoaId: filtroPessoaId || null,
          limite: 200,
        });
        if (ativo) setVarreduras(lista);
      } catch (e) {
        if (ativo) setErro(e.message || 'Falha ao carregar o histórico de varreduras.');
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [filtroPessoaId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        <div className="p-5 border-b border-slate-200 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <History className="w-5 h-5 text-blue-700" /> Histórico de varreduras
            </h3>
            <p className="text-sm text-slate-500">
              Cada linha é uma execução: quando rodou, qual pessoa, quantas páginas e processos, e o
              erro quando houve. Últimas 200 execuções.
            </p>
          </div>
          <select
            value={filtroPessoaId}
            onChange={(e) => setFiltroPessoaId(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white shrink-0"
          >
            <option value="">Todas as pessoas</option>
            {pessoas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="p-4 overflow-y-auto grow">
          {carregando ? (
            <div className="flex items-center gap-3 text-slate-600 py-8 justify-center">
              <Loader2 className="w-5 h-5 animate-spin" /> Carregando histórico…
            </div>
          ) : erro ? (
            <div className="border border-rose-200 bg-rose-50 text-rose-800 rounded-lg p-3 text-sm">{erro}</div>
          ) : varreduras.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-sm">
              Nenhuma varredura registrada{filtroPessoaId ? ' para esta pessoa' : ''} ainda. As
              execuções aparecem aqui assim que a varredura automática rodar.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-400 border-b border-slate-200">
                  <th className="py-2 pr-3">Início</th>
                  <th className="py-2 pr-3">Pessoa</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3 text-right">Duração</th>
                  <th className="py-2 pr-3 text-right" title="Páginas da lista lidas no PROJUDI">Págs.</th>
                  <th className="py-2 pr-3 text-right" title="Linhas de processo vistas na varredura">Vistos</th>
                  <th className="py-2 pr-3 text-right" title="Processos inéditos gravados">Novos</th>
                  <th className="py-2 text-right" title="Linhas em segredo de justiça">Segredo</th>
                </tr>
              </thead>
              <tbody>
                {varreduras.map((v) => (
                  <tr key={v.id} className="border-b border-slate-100 align-top">
                    <td className="py-2 pr-3 whitespace-nowrap text-slate-700">{fmtDataHora(v.inicio)}</td>
                    <td className="py-2 pr-3 text-slate-700">{v.pessoaNome}</td>
                    <td className="py-2 pr-3">
                      <StatusVarreduraBadge status={v.status} />
                      {v.erroCodigo ? (
                        <div className="mt-0.5 text-xs text-rose-700" title={v.erroMensagem || ''}>
                          {v.erroCodigo}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3 text-right text-slate-600 whitespace-nowrap">{fmtDuracao(v.duracaoSegundos)}</td>
                    <td className="py-2 pr-3 text-right text-slate-600">{v.paginasLidas ?? '—'}</td>
                    <td className="py-2 pr-3 text-right text-slate-600">{v.encontrados ?? '—'}</td>
                    <td className={`py-2 pr-3 text-right font-semibold ${v.novos > 0 ? 'text-amber-700' : 'text-slate-600'}`}>
                      {v.novos ?? '—'}
                    </td>
                    <td className="py-2 text-right text-slate-600">{v.qtdSegredo ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onFechar}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

/** Tela Processos → Monitoramento: caixa de entrada dos descobertos da varredura PROJUDI. */
export function MonitoramentoProjudiPage() {
  const [pessoas, setPessoas] = useState([]);
  const [pessoaSelecionada, setPessoaSelecionada] = useState(null);
  const [filtroSituacao, setFiltroSituacao] = useState('NOVO');
  const [filtroPessoaId, setFiltroPessoaId] = useState('');
  const [descobertos, setDescobertos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [modalCadastro, setModalCadastro] = useState(null);
  const [modalAviso, setModalAviso] = useState(null);
  const [modalHistorico, setModalHistorico] = useState(false);
  const [ultimaVarredura, setUltimaVarredura] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [revisao, setRevisao] = useState(0);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const [ps, ds, vs] = await Promise.all([
        listarPessoasMonitoradas(),
        listarDescobertos(filtroSituacao),
        listarVarreduras({ limite: 1 }),
      ]);
      setPessoas(ps);
      setDescobertos(ds);
      setUltimaVarredura(vs[0] || null);
    } catch (e) {
      setErro(e.message || 'Falha ao carregar o monitoramento.');
    } finally {
      setCarregando(false);
    }
  }, [filtroSituacao]);

  useEffect(() => {
    carregar();
  }, [carregar, revisao]);

  const recarregarTudo = () => setRevisao((r) => r + 1);

  const ignorar = async (d) => {
    setBusyId(d.id);
    setErro('');
    try {
      await ignorarDescoberto(d.id);
      recarregarTudo();
    } catch (e) {
      setErro(e.message || 'Falha ao ignorar.');
    } finally {
      setBusyId(null);
    }
  };

  const visiveis = useMemo(
    () =>
      filtroPessoaId
        ? descobertos.filter((d) => String(d.pessoa?.id) === String(filtroPessoaId))
        : descobertos,
    [descobertos, filtroPessoaId],
  );

  const rotuloFiltro = FILTROS_SITUACAO.find((f) => f.valor === filtroSituacao)?.rotulo || filtroSituacao;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <UserSearch className="w-6 h-6 text-blue-700" />
          <div>
            <h1 className="text-xl font-bold text-slate-800">Monitoramento de pessoas — PROJUDI</h1>
            <p className="text-sm text-slate-500">
              Processos descobertos pela varredura por CPF/CNPJ das pessoas marcadas.
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {ultimaVarredura ? (
                <>
                  Última varredura: <strong className="text-slate-700">{fmtDataHora(ultimaVarredura.inicio)}</strong>
                  {' — '}{ultimaVarredura.pessoaNome}{' '}
                  <StatusVarreduraBadge status={ultimaVarredura.status} />
                </>
              ) : (
                'Nenhuma varredura executada ainda.'
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setModalHistorico(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100"
          >
            <History className="w-4 h-4" /> Histórico de varreduras
          </button>
          <button
            type="button"
            onClick={recarregarTudo}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100"
          >
            <RefreshCw className="w-4 h-4" /> Atualizar
          </button>
        </div>
      </div>

      {pessoaSelecionada ? (
        <PainelPessoa
          pessoa={pessoaSelecionada}
          onVoltar={() => setPessoaSelecionada(null)}
          onCadastrar={(d) => setModalCadastro(d)}
          onAvisar={(d) => setModalAviso(d)}
          onIgnorar={ignorar}
          busyId={busyId}
          revisao={revisao}
        />
      ) : (
        <>
          {pessoas.length > 0 ? (
            <div className="flex gap-2 flex-wrap">
              {pessoas.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPessoaSelecionada(p)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:border-blue-400 text-left shadow-sm"
                >
                  <div>
                    <div className="text-sm font-medium text-slate-800">{p.nome}</div>
                    <div className="text-xs text-slate-500">
                      {fmtCpfCnpj(p.cpf)} · {p.totalDescobertos} descobertos
                      {p.qtdSegredo > 0 ? ` · ${p.qtdSegredo} em segredo` : ''}
                    </div>
                  </div>
                  {p.alertas > 0 ? (
                    <span className="ml-1 inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded-full bg-amber-500 text-white text-xs font-bold">
                      {p.alertas}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={filtroSituacao}
              onChange={(e) => setFiltroSituacao(e.target.value)}
              className="px-2 py-1.5 text-sm border border-slate-300 rounded-lg bg-white"
            >
              {FILTROS_SITUACAO.map((f) => (
                <option key={f.valor} value={f.valor}>
                  {f.rotulo}
                </option>
              ))}
            </select>
            <select
              value={filtroPessoaId}
              onChange={(e) => setFiltroPessoaId(e.target.value)}
              className="px-2 py-1.5 text-sm border border-slate-300 rounded-lg bg-white"
            >
              <option value="">Todas as pessoas</option>
              {pessoas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </div>

          {erro ? (
            <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-3">{erro}</div>
          ) : null}

          {carregando ? (
            <div className="flex items-center gap-2 text-slate-500 py-10 justify-center">
              <Loader2 className="w-5 h-5 animate-spin" /> Carregando…
            </div>
          ) : visiveis.length === 0 ? (
            filtroSituacao === 'NOVO' ? (
              <div className="flex flex-col items-center gap-2 text-center py-12 bg-white border border-slate-200 rounded-2xl">
                <BellOff className="w-10 h-10 text-slate-300" />
                <div className="text-slate-700 font-medium">Nenhum processo novo desde a última varredura</div>
                <div className="text-sm text-slate-500 max-w-md">
                  A varredura roda automaticamente e compara com o que já foi visto. Quando um
                  processo novo aparecer para uma pessoa monitorada, ele chega aqui como alerta.
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-center py-12 bg-white border border-slate-200 rounded-2xl">
                <Inbox className="w-10 h-10 text-slate-300" />
                <div className="text-slate-600">Nada em “{rotuloFiltro}”.</div>
              </div>
            )
          ) : (
            <div className="space-y-3">
              {visiveis.map((d) => (
                <CardDescoberto
                  key={d.id}
                  d={d}
                  mostrarPessoa
                  onCadastrar={(x) => setModalCadastro(x)}
                  onAvisar={(x) => setModalAviso(x)}
                  onIgnorar={ignorar}
                  busyId={busyId}
                />
              ))}
            </div>
          )}
        </>
      )}

      {modalCadastro ? (
        <ModalCadastro
          descoberto={modalCadastro}
          onFechar={() => setModalCadastro(null)}
          onConcluido={recarregarTudo}
        />
      ) : null}

      {modalAviso ? (
        <ModalAviso
          descoberto={modalAviso}
          onFechar={() => setModalAviso(null)}
          onConcluido={recarregarTudo}
        />
      ) : null}

      {modalHistorico ? (
        <ModalHistoricoVarreduras pessoas={pessoas} onFechar={() => setModalHistorico(false)} />
      ) : null}
    </div>
  );
}
