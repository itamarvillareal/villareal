import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarClock,
  Loader2,
  MoreHorizontal,
  Plus,
  RefreshCw,
  X,
} from 'lucide-react';
import { formatBRL } from '../../data/relatorioCalculosData.js';
import { listarImoveisApi } from '../../repositories/imoveisRepository.js';
import { listarUsuarios } from '../../repositories/usuariosRepository.js';
import {
  ativarRecorrencia,
  buscarPagamentosGerados,
  criarRecorrencia,
  desativarRecorrencia,
  editarRecorrencia,
  gerarMes,
  listarRecorrencias,
} from '../../repositories/recorrenciasRepository.js';
import {
  badgeCategoriaClass,
  badgeStatusClass,
  badgeStatusStyle,
  CATEGORIAS_PAGAMENTO,
  ROTULO_STATUS,
} from './pagamentosUiUtils.js';

const FORMAS_PAGAMENTO = [
  'BOLETO',
  'PIX',
  'TRANSFERENCIA',
  'TED_DOC',
  'CARTAO',
  'DEBITO_AUTOMATICO',
  'GUIA_JUDICIAL',
  'DEPOSITO_JUDICIAL',
  'DARF',
  'DAE',
  'GPS',
  'GRU',
  'OUTRO',
];

const PRIORIDADES = ['URGENTE', 'ALTA', 'NORMAL', 'BAIXA'];

const ROTULO_CATEGORIA = {
  AGUA: 'Água',
  ENERGIA: 'Energia',
  CONDOMINIO: 'Condomínio',
  ALUGUEL: 'Aluguel',
  TRIBUTO: 'Tributo',
  IMPOSTO: 'Imposto',
  INTERNET: 'Internet',
  OUTROS: 'Outros',
};

function mesAnoAtual() {
  const d = new Date();
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function rotuloCategoria(cat) {
  return ROTULO_CATEGORIA[cat] || cat;
}

function defaultForm() {
  return {
    imovelId: '',
    clienteId: '',
    contratoLocacaoId: '',
    categoria: '',
    descricaoPadrao: '',
    contaReferencia: '',
    diaVencimento: '10',
    valorEstimado: '',
    formaPagamento: 'BOLETO',
    responsavelUsuarioId: '',
    prioridade: 'NORMAL',
  };
}

function parseValorInput(s) {
  const t = String(s ?? '').trim();
  if (!t) return null;
  const n = Number(t.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function RecorrenciasPagamento({ onGeracaoConcluida }) {
  const navigate = useNavigate();
  const [lista, setLista] = useState([]);
  const [imoveis, setImoveis] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagemOk, setMensagemOk] = useState('');

  const [filtroImovel, setFiltroImovel] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroAtivo, setFiltroAtivo] = useState('true');

  const [modalForm, setModalForm] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [salvando, setSalvando] = useState(false);

  const [modalGerar, setModalGerar] = useState(false);
  const [mesAnoGerar, setMesAnoGerar] = useState(mesAnoAtual);
  const [gerando, setGerando] = useState(false);
  const [resultadoGerar, setResultadoGerar] = useState(null);

  const [drawerConfig, setDrawerConfig] = useState(null);
  const [gerados, setGerados] = useState([]);
  const [carregandoGerados, setCarregandoGerados] = useState(false);

  const [menuAbertoId, setMenuAbertoId] = useState(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const q = {};
      if (filtroImovel) q.imovelId = Number(filtroImovel);
      if (filtroCategoria) q.categoria = filtroCategoria;
      if (filtroAtivo === 'true') q.ativo = true;
      else if (filtroAtivo === 'false') q.ativo = false;
      const rows = await listarRecorrencias(q);
      setLista(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setErro(e?.message || 'Falha ao carregar recorrências.');
    } finally {
      setCarregando(false);
    }
  }, [filtroImovel, filtroCategoria, filtroAtivo]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    Promise.all([listarImoveisApi(), listarUsuarios()])
      .then(([im, us]) => {
        setImoveis(Array.isArray(im) ? im : []);
        setUsuarios(Array.isArray(us) ? us : []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!mensagemOk) return undefined;
    const t = setTimeout(() => setMensagemOk(''), 4500);
    return () => clearTimeout(t);
  }, [mensagemOk]);

  const imovelPorId = useMemo(() => {
    const m = new Map();
    for (const im of imoveis) {
      const id = im.id ?? im._apiImovelId;
      if (id != null) m.set(Number(id), im);
    }
    return m;
  }, [imoveis]);

  function abrirNova() {
    setForm(defaultForm());
    setModalForm({ modo: 'criar' });
  }

  function abrirEditar(row) {
    setForm({
      imovelId: row.imovelId != null ? String(row.imovelId) : '',
      clienteId: row.clienteId != null ? String(row.clienteId) : '',
      contratoLocacaoId: row.contratoLocacaoId != null ? String(row.contratoLocacaoId) : '',
      categoria: row.categoria || '',
      descricaoPadrao: row.descricaoPadrao || '',
      contaReferencia: row.contaReferencia || '',
      diaVencimento: row.diaVencimento != null ? String(row.diaVencimento) : '10',
      valorEstimado: row.valorEstimado != null ? String(row.valorEstimado) : '',
      formaPagamento: row.formaPagamento || 'BOLETO',
      responsavelUsuarioId: row.responsavelUsuarioId != null ? String(row.responsavelUsuarioId) : '',
      prioridade: row.prioridade || 'NORMAL',
    });
    setModalForm({ modo: 'editar', id: row.id });
  }

  function sugerirDescricao(imovelId, categoria) {
    const im = imovelPorId.get(Number(imovelId));
    const plan = im?.numeroPlanilha ?? im?.id ?? '';
    const nome = rotuloCategoria(categoria);
    if (nome && plan) return `${nome} ${plan}`;
    return '';
  }

  function onChangeImovel(id) {
    const im = imovelPorId.get(Number(id));
    const cid = im?.clienteId ?? im?._apiClienteId;
    setForm((f) => {
      const next = { ...f, imovelId: id };
      if (cid != null) next.clienteId = String(cid);
      if (!f.descricaoPadrao?.trim() && f.categoria) {
        const sug = sugerirDescricao(id, f.categoria);
        if (sug) next.descricaoPadrao = sug;
      }
      return next;
    });
  }

  function onChangeCategoria(cat) {
    setForm((f) => {
      const next = { ...f, categoria: cat };
      if (!f.descricaoPadrao?.trim() && f.imovelId) {
        const sug = sugerirDescricao(f.imovelId, cat);
        if (sug) next.descricaoPadrao = sug;
      }
      return next;
    });
  }

  async function salvarForm() {
    if (!form.imovelId || !form.categoria || !form.descricaoPadrao?.trim() || !form.diaVencimento) {
      setErro('Preencha imóvel, categoria, descrição e dia de vencimento.');
      return;
    }
    const dia = Number(form.diaVencimento);
    if (dia < 1 || dia > 31) {
      setErro('Dia de vencimento deve estar entre 1 e 31.');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      const body = {
        imovelId: Number(form.imovelId),
        categoria: form.categoria,
        descricaoPadrao: form.descricaoPadrao.trim(),
        contaReferencia: form.contaReferencia?.trim() || null,
        diaVencimento: dia,
        valorEstimado: parseValorInput(form.valorEstimado),
        formaPagamento: form.formaPagamento,
        prioridade: form.prioridade || 'NORMAL',
        clienteId: form.clienteId ? Number(form.clienteId) : null,
        contratoLocacaoId: form.contratoLocacaoId ? Number(form.contratoLocacaoId) : null,
        responsavelUsuarioId: form.responsavelUsuarioId ? Number(form.responsavelUsuarioId) : null,
      };
      if (modalForm?.modo === 'editar') {
        await editarRecorrencia(modalForm.id, body);
        setMensagemOk('Recorrência atualizada.');
      } else {
        await criarRecorrencia(body);
        setMensagemOk('Recorrência criada.');
      }
      setModalForm(null);
      await carregar();
    } catch (e) {
      setErro(e?.message || 'Falha ao salvar.');
    } finally {
      setSalvando(false);
    }
  }

  async function toggleAtivo(row) {
    setMenuAbertoId(null);
    setErro('');
    try {
      if (row.ativo) {
        await desativarRecorrencia(row.id);
        setMensagemOk('Recorrência desativada.');
      } else {
        await ativarRecorrencia(row.id);
        setMensagemOk('Recorrência reativada.');
      }
      await carregar();
    } catch (e) {
      setErro(e?.message || 'Falha na operação.');
    }
  }

  async function abrirGerados(row) {
    setMenuAbertoId(null);
    setDrawerConfig(row);
    setCarregandoGerados(true);
    setGerados([]);
    try {
      const page = await buscarPagamentosGerados(row.id, { page: 0, size: 12 });
      setGerados(Array.isArray(page?.content) ? page.content : []);
    } catch (e) {
      setErro(e?.message || 'Falha ao carregar pagamentos gerados.');
      setDrawerConfig(null);
    } finally {
      setCarregandoGerados(false);
    }
  }

  async function executarGerar() {
    setGerando(true);
    setErro('');
    setResultadoGerar(null);
    try {
      const res = await gerarMes(mesAnoGerar.trim());
      setResultadoGerar(res);
      if (res?.gerados > 0 && onGeracaoConcluida) onGeracaoConcluida();
    } catch (e) {
      setErro(e?.message || 'Falha ao gerar lançamentos.');
    } finally {
      setGerando(false);
    }
  }

  function fecharModalGerar() {
    setModalGerar(false);
    setResultadoGerar(null);
    void carregar();
  }

  return (
    <div className="flex flex-col gap-4">
      {mensagemOk ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
          {mensagemOk}
        </div>
      ) : null}
      {erro ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200">
          {erro}
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-2 justify-between">
        <div className="flex flex-wrap gap-2 items-end text-xs">
          <label className="flex flex-col gap-0.5">
            <span className="text-slate-500">Imóvel</span>
            <select
              className="rounded border border-slate-300 px-2 py-1 min-w-[140px] dark:bg-slate-950"
              value={filtroImovel}
              onChange={(e) => setFiltroImovel(e.target.value)}
            >
              <option value="">Todos</option>
              {imoveis.map((im) => (
                <option key={im.id ?? im._apiImovelId} value={String(im.id ?? im._apiImovelId)}>
                  #{im.numeroPlanilha ?? im.id}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-slate-500">Categoria</span>
            <select
              className="rounded border border-slate-300 px-2 py-1 dark:bg-slate-950"
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
            >
              <option value="">Todas</option>
              {CATEGORIAS_PAGAMENTO.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-slate-500">Status</span>
            <select
              className="rounded border border-slate-300 px-2 py-1 dark:bg-slate-950"
              value={filtroAtivo}
              onChange={(e) => setFiltroAtivo(e.target.value)}
            >
              <option value="true">Ativas</option>
              <option value="false">Inativas</option>
              <option value="">Todas</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => void carregar()}
            className="inline-flex items-center gap-1 rounded border px-2 py-1 text-slate-700 dark:border-slate-600"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Atualizar
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setMesAnoGerar(mesAnoAtual());
              setResultadoGerar(null);
              setModalGerar(true);
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium dark:border-slate-600 dark:bg-slate-800"
          >
            <CalendarClock className="w-4 h-4" />
            Gerar lançamentos do mês
          </button>
          <button
            type="button"
            onClick={abrirNova}
            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <Plus className="w-4 h-4" />
            Nova recorrência
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/85">
        {carregando ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-7 h-7 animate-spin text-emerald-600" />
          </div>
        ) : !lista.length ? (
          <p className="text-sm text-slate-500 text-center py-10">Nenhuma recorrência encontrada.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-slate-100 dark:bg-slate-800">
              <tr>
                <th className="px-2 py-2 text-left">Imóvel</th>
                <th className="px-2 py-2 text-left">Categoria</th>
                <th className="px-2 py-2 text-left">Descrição</th>
                <th className="px-2 py-2 text-center">Dia Venc.</th>
                <th className="px-2 py-2 text-right">Valor Est.</th>
                <th className="px-2 py-2 text-left">Forma Pgto</th>
                <th className="px-2 py-2 text-center">Ativo</th>
                <th className="px-2 py-2 w-10" />
              </tr>
            </thead>
            <tbody>
              {lista.map((row) => (
                <tr key={row.id} className="border-t border-slate-200 dark:border-slate-700">
                  <td className="px-2 py-1.5">
                    <span className="font-medium">{row.imovelNumeroPlanilha ?? row.imovelId}</span>
                    {row.imovelEndereco ? (
                      <span className="block text-slate-500 truncate max-w-[160px]" title={row.imovelEndereco}>
                        {row.imovelEndereco}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-2 py-1.5">
                    <span className={badgeCategoriaClass(row.categoria)}>{row.categoria}</span>
                  </td>
                  <td className="px-2 py-1.5 max-w-[200px] truncate" title={row.descricaoPadrao}>
                    {row.descricaoPadrao}
                  </td>
                  <td className="px-2 py-1.5 text-center">{row.diaVencimento}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {row.valorEstimado != null ? (
                      formatBRL(Number(row.valorEstimado))
                    ) : (
                      <span className="text-slate-400" title="Valor variável">
                        —
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1.5">{row.formaPagamento}</td>
                  <td className="px-2 py-1.5 text-center">
                    {row.ativo ? (
                      <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                        Ativa
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                        Inativa
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 relative">
                    <button
                      type="button"
                      className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
                      onClick={() => setMenuAbertoId(menuAbertoId === row.id ? null : row.id)}
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                    {menuAbertoId === row.id ? (
                      <div className="absolute right-0 top-7 z-20 min-w-[180px] rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-900 py-1">
                        <button
                          type="button"
                          className="w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"
                          onClick={() => {
                            setMenuAbertoId(null);
                            abrirEditar(row);
                          }}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"
                          onClick={() => void toggleAtivo(row)}
                        >
                          {row.ativo ? 'Desativar' : 'Ativar'}
                        </button>
                        <button
                          type="button"
                          className="w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"
                          onClick={() => void abrirGerados(row)}
                        >
                          Ver pagamentos gerados
                        </button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b dark:border-slate-700">
              <h2 className="font-semibold">
                {modalForm.modo === 'editar' ? 'Editar recorrência' : 'Nova recorrência'}
              </h2>
              <button type="button" onClick={() => setModalForm(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 grid gap-3 text-sm">
              <label className="flex flex-col gap-1">
                Imóvel *
                <select
                  className="rounded border px-2 py-1.5 dark:bg-slate-950"
                  value={form.imovelId}
                  onChange={(e) => onChangeImovel(e.target.value)}
                >
                  <option value="">Selecione</option>
                  {imoveis.map((im) => (
                    <option key={im.id ?? im._apiImovelId} value={String(im.id ?? im._apiImovelId)}>
                      #{im.numeroPlanilha ?? im.id}{' '}
                      {im.condominio || im.enderecoCompleto
                        ? `— ${String(im.condominio || im.enderecoCompleto).slice(0, 40)}`
                        : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                Categoria *
                <select
                  className="rounded border px-2 py-1.5 dark:bg-slate-950"
                  value={form.categoria}
                  onChange={(e) => onChangeCategoria(e.target.value)}
                >
                  <option value="">Selecione</option>
                  {CATEGORIAS_PAGAMENTO.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                Descrição padrão *
                <input
                  className="rounded border px-2 py-1.5 dark:bg-slate-950"
                  value={form.descricaoPadrao}
                  onChange={(e) => setForm((f) => ({ ...f, descricaoPadrao: e.target.value }))}
                  placeholder="Ex: Água F-18"
                />
              </label>
              <label className="flex flex-col gap-1">
                Conta referência
                <input
                  className="rounded border px-2 py-1.5 dark:bg-slate-950"
                  value={form.contaReferencia}
                  onChange={(e) => setForm((f) => ({ ...f, contaReferencia: e.target.value }))}
                  placeholder="Matrícula concessionária"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  Dia vencimento *
                  <input
                    type="number"
                    min={1}
                    max={31}
                    className="rounded border px-2 py-1.5 dark:bg-slate-950"
                    value={form.diaVencimento}
                    onChange={(e) => setForm((f) => ({ ...f, diaVencimento: e.target.value }))}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  Valor estimado
                  <input
                    className="rounded border px-2 py-1.5 dark:bg-slate-950"
                    value={form.valorEstimado}
                    onChange={(e) => setForm((f) => ({ ...f, valorEstimado: e.target.value }))}
                    placeholder="Vazio = valor variável"
                  />
                </label>
              </div>
              <label className="flex flex-col gap-1">
                Forma de pagamento *
                <select
                  className="rounded border px-2 py-1.5 dark:bg-slate-950"
                  value={form.formaPagamento}
                  onChange={(e) => setForm((f) => ({ ...f, formaPagamento: e.target.value }))}
                >
                  {FORMAS_PAGAMENTO.map((fp) => (
                    <option key={fp} value={fp}>
                      {fp}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                Responsável
                <select
                  className="rounded border px-2 py-1.5 dark:bg-slate-950"
                  value={form.responsavelUsuarioId}
                  onChange={(e) => setForm((f) => ({ ...f, responsavelUsuarioId: e.target.value }))}
                >
                  <option value="">Nenhum</option>
                  {usuarios.map((u) => (
                    <option key={u.id} value={String(u.id)}>
                      {u.nome || u.login || u.id}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                Prioridade
                <select
                  className="rounded border px-2 py-1.5 dark:bg-slate-950"
                  value={form.prioridade}
                  onChange={(e) => setForm((f) => ({ ...f, prioridade: e.target.value }))}
                >
                  {PRIORIDADES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-2 px-4 py-3 border-t dark:border-slate-700">
              <button type="button" className="px-3 py-1.5 text-sm rounded border" onClick={() => setModalForm(null)}>
                Cancelar
              </button>
              <button
                type="button"
                disabled={salvando}
                onClick={() => void salvarForm()}
                className="px-3 py-1.5 text-sm rounded bg-emerald-600 text-white font-semibold disabled:opacity-60"
              >
                {salvando ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null}
                Salvar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {modalGerar ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between px-4 py-3 border-b dark:border-slate-700">
              <h2 className="font-semibold">Gerar lançamentos do mês</h2>
              <button type="button" onClick={fecharModalGerar}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 text-sm space-y-3">
              {!resultadoGerar ? (
                <>
                  <p className="text-slate-600 dark:text-slate-400">
                    Serão gerados pagamentos PENDENTE para todas as recorrências ativas que ainda não têm lançamento no
                    mês selecionado.
                  </p>
                  <label className="flex flex-col gap-1">
                    Mês/Ano (MM/YYYY)
                    <input
                      className="rounded border px-2 py-1.5 dark:bg-slate-950"
                      value={mesAnoGerar}
                      onChange={(e) => setMesAnoGerar(e.target.value)}
                      placeholder="06/2026"
                    />
                  </label>
                </>
              ) : (
                <>
                  <p className="font-medium">
                    Gerados: {resultadoGerar.gerados} | Já existiam: {resultadoGerar.jaExistiam} | Erros:{' '}
                    {resultadoGerar.erros}
                  </p>
                  {(resultadoGerar.detalhes || [])
                    .filter((d) => d.resultado === 'GERADO')
                    .map((d) => (
                      <div key={`g-${d.configId}`} className="text-emerald-800 dark:text-emerald-200 text-xs">
                        ✓ {d.descricao} ({d.imovelNumeroPlanilha})
                      </div>
                    ))}
                  {(resultadoGerar.detalhes || [])
                    .filter((d) => d.resultado === 'ERRO')
                    .map((d) => (
                      <div key={`e-${d.configId}`} className="text-red-700 dark:text-red-300 text-xs">
                        ✗ {d.descricao}: {d.mensagemErro}
                      </div>
                    ))}
                </>
              )}
            </div>
            <div className="flex justify-end gap-2 px-4 py-3 border-t dark:border-slate-700">
              <button type="button" className="px-3 py-1.5 text-sm rounded border" onClick={fecharModalGerar}>
                {resultadoGerar ? 'Fechar' : 'Cancelar'}
              </button>
              {!resultadoGerar ? (
                <button
                  type="button"
                  disabled={gerando}
                  onClick={() => void executarGerar()}
                  className="px-3 py-1.5 text-sm rounded bg-emerald-600 text-white font-semibold disabled:opacity-60"
                >
                  {gerando ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null}
                  Gerar
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {drawerConfig ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
          <div className="w-full max-w-md h-full bg-white dark:bg-slate-900 shadow-xl border-l dark:border-slate-700 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b dark:border-slate-700">
              <div>
                <h2 className="font-semibold text-sm">Pagamentos gerados</h2>
                <p className="text-xs text-slate-500">{drawerConfig.descricaoPadrao}</p>
              </div>
              <button type="button" onClick={() => setDrawerConfig(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {carregandoGerados ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : !gerados.length ? (
                <p className="text-sm text-slate-500 text-center py-6">Nenhum lançamento gerado ainda.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-500">
                      <th className="text-left py-1">Mês</th>
                      <th className="text-left py-1">Venc.</th>
                      <th className="text-right py-1">Valor</th>
                      <th className="text-left py-1">Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {gerados.map((p) => (
                      <tr key={p.id} className="border-t border-slate-200 dark:border-slate-700">
                        <td className="py-1.5">{p.mesReferencia}</td>
                        <td className="py-1.5">{p.dataVencimento}</td>
                        <td className="py-1.5 text-right tabular-nums">
                          {p.valor != null ? formatBRL(Number(p.valor)) : '—'}
                        </td>
                        <td className="py-1.5">
                          <span className={badgeStatusClass(p.status)} style={badgeStatusStyle(p.status)}>
                            {ROTULO_STATUS[p.status] || p.status}
                          </span>
                        </td>
                        <td className="py-1.5">
                          <button
                            type="button"
                            className="text-indigo-700 dark:text-indigo-300 hover:underline"
                            onClick={() => {
                              const q = new URLSearchParams();
                              if (drawerConfig.imovelId) q.set('imovelId', String(drawerConfig.imovelId));
                              if (p.status) q.set('status', p.status);
                              navigate(`/imoveis/pagamentos?${q.toString()}`);
                            }}
                          >
                            Abrir
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
