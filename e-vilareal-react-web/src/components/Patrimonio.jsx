import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, Car, LineChart, Plus, Pencil, Trash2, X, Wallet, Lightbulb, RefreshCw, Search } from 'lucide-react';
import {
  loadPatrimonio,
  savePatrimonio,
  gerarIdPatrimonio,
  loadImoveisSugestaoIgnorados,
  saveImoveisSugestaoIgnorados,
} from '../data/patrimonioStorage.js';
import { listarImoveisApi } from '../repositories/imoveisRepository.js';

/**
 * Códigos de cliente (8 dígitos, sem zeros à esquerda) cujos imóveis devem ser
 * sugeridos para o patrimônio. 149 = 00000149 (Itamar); 938 = 00000938.
 */
const CODIGOS_CLIENTE_PATRIMONIO = [149, 938];

function codigoClienteNumerico(valor) {
  const n = Number(String(valor ?? '').replace(/\D/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** Converte um imóvel da API (cliente 149) num candidato de patrimônio. */
function imovelApiParaCandidato(imovel) {
  const descricao =
    String(imovel?.titulo || '').trim() ||
    String(imovel?.enderecoCompleto || '').trim() ||
    `Imóvel ${imovel?.numeroPlanilha ?? imovel?.id ?? ''}`.trim();
  return {
    origemImovelId: imovel?.id ?? null,
    descricao,
    tipo: String(imovel?.tipoImovel || '').trim(),
    endereco: String(imovel?.enderecoCompleto || '').trim(),
    matricula: String(imovel?.inscricaoImobiliaria || '').trim(),
    valor: '',
  };
}

const moedaBRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

function formatarMoeda(valor) {
  const n = Number(valor);
  return moedaBRL.format(Number.isFinite(n) ? n : 0);
}

/** Configuração de cada categoria: rótulos, ícone, campos do formulário e resumo do card. */
const CATEGORIAS = {
  imoveis: {
    label: 'Imóveis',
    singular: 'Imóvel',
    Icon: Building2,
    cor: 'emerald',
    campos: [
      { name: 'descricao', label: 'Descrição', tipo: 'text', placeholder: 'Apartamento, casa, terreno…', principal: true },
      { name: 'tipo', label: 'Tipo', tipo: 'text', placeholder: 'Residencial, comercial, rural…' },
      { name: 'endereco', label: 'Endereço', tipo: 'text', placeholder: 'Rua, número, cidade/UF', largo: true },
      { name: 'matricula', label: 'Matrícula / Registro', tipo: 'text', placeholder: 'Nº da matrícula' },
      { name: 'valor', label: 'Valor estimado', tipo: 'moeda', placeholder: '0,00' },
    ],
    subtitulo: (item) => [item.tipo, item.endereco].filter(Boolean).join(' · '),
  },
  veiculos: {
    label: 'Veículos',
    singular: 'Veículo',
    Icon: Car,
    cor: 'sky',
    campos: [
      { name: 'descricao', label: 'Descrição', tipo: 'text', placeholder: 'Marca e modelo', principal: true },
      { name: 'ano', label: 'Ano', tipo: 'text', placeholder: '2020' },
      { name: 'placa', label: 'Placa', tipo: 'text', placeholder: 'ABC1D23' },
      { name: 'renavam', label: 'Renavam', tipo: 'text', placeholder: 'Nº do Renavam' },
      { name: 'valor', label: 'Valor estimado', tipo: 'moeda', placeholder: '0,00' },
    ],
    subtitulo: (item) => [item.ano, item.placa].filter(Boolean).join(' · '),
  },
  aplicacoes: {
    label: 'Aplicações financeiras',
    singular: 'Aplicação',
    Icon: LineChart,
    cor: 'violet',
    campos: [
      { name: 'descricao', label: 'Descrição', tipo: 'text', placeholder: 'CDB, Tesouro, fundo…', principal: true },
      { name: 'instituicao', label: 'Instituição', tipo: 'text', placeholder: 'Banco / corretora' },
      { name: 'tipo', label: 'Tipo', tipo: 'text', placeholder: 'Renda fixa, ações, FII…' },
      { name: 'vencimento', label: 'Vencimento', tipo: 'date' },
      { name: 'valor', label: 'Valor aplicado', tipo: 'moeda', placeholder: '0,00' },
    ],
    subtitulo: (item) => [item.instituicao, item.tipo].filter(Boolean).join(' · '),
  },
};

const ORDEM_CATEGORIAS = ['imoveis', 'veiculos', 'aplicacoes'];

const CORES = {
  emerald: {
    chipAtivo: 'bg-emerald-600 text-white border-emerald-600',
    cardBorda: 'border-emerald-200 dark:border-emerald-500/20',
    icone: 'text-emerald-600 dark:text-emerald-400',
    total: 'text-emerald-700 dark:text-emerald-300',
    botao: 'bg-emerald-600 hover:bg-emerald-700',
  },
  sky: {
    chipAtivo: 'bg-sky-600 text-white border-sky-600',
    cardBorda: 'border-sky-200 dark:border-sky-500/20',
    icone: 'text-sky-600 dark:text-sky-400',
    total: 'text-sky-700 dark:text-sky-300',
    botao: 'bg-sky-600 hover:bg-sky-700',
  },
  violet: {
    chipAtivo: 'bg-violet-600 text-white border-violet-600',
    cardBorda: 'border-violet-200 dark:border-violet-500/20',
    icone: 'text-violet-600 dark:text-violet-400',
    total: 'text-violet-700 dark:text-violet-300',
    botao: 'bg-violet-600 hover:bg-violet-700',
  },
};

function totalCategoria(lista) {
  return (lista || []).reduce((acc, item) => {
    const n = Number(item?.valor);
    return acc + (Number.isFinite(n) ? n : 0);
  }, 0);
}

function formularioVazio(catKey) {
  const base = { id: null };
  for (const campo of CATEGORIAS[catKey].campos) {
    base[campo.name] = '';
  }
  return base;
}

export function Patrimonio() {
  const [estado, setEstado] = useState(() => loadPatrimonio());
  const [categoriaAtiva, setCategoriaAtiva] = useState('imoveis');
  const [form, setForm] = useState(null);
  const [imoveisCadastro, setImoveisCadastro] = useState([]);
  const [ignorados, setIgnorados] = useState(() => new Set(loadImoveisSugestaoIgnorados()));

  useEffect(() => {
    const h = () => setEstado(loadPatrimonio());
    window.addEventListener('vilareal:patrimonio-atualizado', h);
    return () => window.removeEventListener('vilareal:patrimonio-atualizado', h);
  }, []);

  /** Lista completa do cadastro de imóveis (API) — base das sugestões e da busca por número. */
  const carregarImoveisCadastro = useCallback(async () => {
    const lista = await listarImoveisApi();
    setImoveisCadastro(Array.isArray(lista) ? lista : []);
  }, []);

  useEffect(() => {
    let ativo = true;
    void listarImoveisApi().then((lista) => {
      if (!ativo) return;
      setImoveisCadastro(Array.isArray(lista) ? lista : []);
    });
    return () => {
      ativo = false;
    };
  }, []);

  /** Candidatos de sugestão: imóveis dos clientes 149/938. */
  const imoveisCliente = useMemo(
    () =>
      imoveisCadastro
        .filter((im) => CODIGOS_CLIENTE_PATRIMONIO.includes(codigoClienteNumerico(im?.codigoCliente)))
        .map(imovelApiParaCandidato)
        .filter((c) => c.origemImovelId != null),
    [imoveisCadastro],
  );

  /** Busca um imóvel do cadastro pelo número (nº da planilha; fallback id da API). */
  const buscarImovelCadastroPorNumero = useCallback(
    (numero) => {
      const n = Number(String(numero ?? '').replace(/\D/g, ''));
      if (!Number.isFinite(n) || n < 1) return null;
      const im =
        imoveisCadastro.find((x) => Number(x?.numeroPlanilha) === n) ||
        imoveisCadastro.find((x) => Number(x?.id) === n);
      return im ? imovelApiParaCandidato(im) : null;
    },
    [imoveisCadastro],
  );

  /** Reabilita sugestões rejeitadas e recarrega da API (pedido explícito do usuário). */
  const atualizarSugestoes = () => {
    setIgnorados(new Set());
    saveImoveisSugestaoIgnorados([]);
    void carregarImoveisCadastro();
  };

  const idsImoveisNoPatrimonio = useMemo(
    () =>
      new Set(
        (estado.imoveis || [])
          .map((x) => x.origemImovelId)
          .filter((v) => v != null),
      ),
    [estado.imoveis],
  );

  const sugestoesImoveis = useMemo(
    () =>
      imoveisCliente.filter(
        (c) => !idsImoveisNoPatrimonio.has(c.origemImovelId) && !ignorados.has(c.origemImovelId),
      ),
    [imoveisCliente, idsImoveisNoPatrimonio, ignorados],
  );

  const config = CATEGORIAS[categoriaAtiva];
  const cores = CORES[config.cor];
  const lista = estado[categoriaAtiva] || [];

  const totais = useMemo(
    () => ({
      imoveis: totalCategoria(estado.imoveis),
      veiculos: totalCategoria(estado.veiculos),
      aplicacoes: totalCategoria(estado.aplicacoes),
    }),
    [estado],
  );
  const totalGeral = totais.imoveis + totais.veiculos + totais.aplicacoes;

  const persistir = (proximo) => {
    setEstado(proximo);
    savePatrimonio(proximo);
  };

  const abrirNovo = () => setForm(formularioVazio(categoriaAtiva));
  const abrirEdicao = (item) => setForm({ ...formularioVazio(categoriaAtiva), ...item });
  const fecharForm = () => setForm(null);

  const salvar = (e) => {
    e.preventDefault();
    if (!form) return;
    const valorNumerico = parseValorMoeda(form.valor);
    const registro = { ...form, valor: valorNumerico };
    const listaAtual = estado[categoriaAtiva] || [];
    let novaLista;
    if (form.id) {
      novaLista = listaAtual.map((x) => (x.id === form.id ? registro : x));
    } else {
      novaLista = [...listaAtual, { ...registro, id: gerarIdPatrimonio() }];
    }
    persistir({ ...estado, [categoriaAtiva]: novaLista });
    setForm(null);
  };

  const remover = (item) => {
    if (!item?.id) return;
    if (!window.confirm(`Remover "${item.descricao || config.singular}" do patrimônio?`)) return;
    const novaLista = (estado[categoriaAtiva] || []).filter((x) => x.id !== item.id);
    persistir({ ...estado, [categoriaAtiva]: novaLista });
  };

  const incluirSugestao = (candidato) => {
    const jaExiste = (estado.imoveis || []).some(
      (x) => x.origemImovelId != null && x.origemImovelId === candidato.origemImovelId,
    );
    if (jaExiste) return;
    const registro = {
      id: gerarIdPatrimonio(),
      descricao: candidato.descricao,
      tipo: candidato.tipo,
      endereco: candidato.endereco,
      matricula: candidato.matricula,
      valor: parseValorMoeda(candidato.valor),
      origemImovelId: candidato.origemImovelId,
    };
    persistir({ ...estado, imoveis: [...(estado.imoveis || []), registro] });
  };

  const incluirTodasSugestoes = () => {
    const novos = sugestoesImoveis.map((candidato) => ({
      id: gerarIdPatrimonio(),
      descricao: candidato.descricao,
      tipo: candidato.tipo,
      endereco: candidato.endereco,
      matricula: candidato.matricula,
      valor: parseValorMoeda(candidato.valor),
      origemImovelId: candidato.origemImovelId,
    }));
    if (novos.length === 0) return;
    persistir({ ...estado, imoveis: [...(estado.imoveis || []), ...novos] });
  };

  const ignorarSugestao = (candidato) => {
    setIgnorados((prev) => {
      const n = new Set(prev);
      n.add(candidato.origemImovelId);
      saveImoveisSugestaoIgnorados([...n]);
      return n;
    });
  };

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-100 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-4">
      <div className="max-w-[1100px] mx-auto space-y-4">
        <header className="rounded-2xl border border-slate-200 bg-white/95 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
              <Wallet className="h-6 w-6" strokeWidth={2} aria-hidden />
            </span>
            <div>
              <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Patrimônio</h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Controle pessoal de imóveis, veículos e aplicações financeiras.
              </p>
            </div>
            <div className="ml-auto text-right">
              <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Patrimônio total
              </div>
              <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                {formatarMoeda(totalGeral)}
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {ORDEM_CATEGORIAS.map((key) => {
              const c = CATEGORIAS[key];
              const cor = CORES[c.cor];
              const Icone = c.Icon;
              return (
                <div
                  key={key}
                  className={`rounded-xl border bg-white p-3 dark:bg-white/[0.03] ${cor.cardBorda}`}
                >
                  <div className="flex items-center gap-2">
                    <Icone className={`h-4 w-4 ${cor.icone}`} strokeWidth={2} aria-hidden />
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      {c.label}
                    </span>
                  </div>
                  <div className={`mt-1 text-lg font-bold ${cor.total}`}>
                    {formatarMoeda(totais[key])}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {(estado[key] || []).length} {(estado[key] || []).length === 1 ? 'item' : 'itens'}
                  </div>
                </div>
              );
            })}
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-2">
          {ORDEM_CATEGORIAS.map((key) => {
            const c = CATEGORIAS[key];
            const cor = CORES[c.cor];
            const ativo = key === categoriaAtiva;
            const Icone = c.Icon;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setCategoriaAtiva(key);
                  setForm(null);
                }}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  ativo
                    ? cor.chipAtivo
                    : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300 dark:hover:bg-white/[0.06]'
                }`}
              >
                <Icone className="h-4 w-4" strokeWidth={2} aria-hidden />
                {c.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={abrirNovo}
            className={`ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors ${cores.botao}`}
          >
            <Plus className="h-4 w-4" strokeWidth={2.2} aria-hidden />
            Adicionar {config.singular.toLowerCase()}
          </button>
        </div>

        {categoriaAtiva === 'imoveis' && sugestoesImoveis.length > 0 ? (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-sm dark:border-amber-500/30 dark:bg-amber-500/[0.08]">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
                <Lightbulb className="h-4 w-4" strokeWidth={2} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                    {sugestoesImoveis.length === 1
                      ? '1 imóvel dos clientes 149/938 pode entrar no seu patrimônio'
                      : `${sugestoesImoveis.length} imóveis dos clientes 149/938 podem entrar no seu patrimônio`}
                  </h3>
                  <div className="ml-auto flex items-center gap-2">
                    <button
                      type="button"
                      onClick={atualizarSugestoes}
                      className="flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-transparent dark:text-amber-200 dark:hover:bg-amber-500/10"
                      title="Reexibe sugestões rejeitadas e busca novos imóveis"
                    >
                      <RefreshCw className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                      Atualizar
                    </button>
                    <button
                      type="button"
                      onClick={incluirTodasSugestoes}
                      className="rounded-lg bg-amber-600 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-amber-700"
                    >
                      Incluir todos
                    </button>
                  </div>
                </div>
                <p className="mt-0.5 text-xs text-amber-800/80 dark:text-amber-200/70">
                  Detectados na lista de imóveis e ainda não cadastrados aqui.
                </p>
                <ul className="mt-3 space-y-2">
                  {sugestoesImoveis.map((candidato) => (
                    <li
                      key={candidato.origemImovelId}
                      className="flex items-center gap-3 rounded-lg border border-amber-200 bg-white px-3 py-2 dark:border-amber-500/20 dark:bg-white/[0.04]"
                    >
                      <Building2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" strokeWidth={2} aria-hidden />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                          {candidato.descricao}
                        </div>
                        {candidato.endereco ? (
                          <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                            {candidato.endereco}
                          </div>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => incluirSugestao(candidato)}
                        className="shrink-0 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        Incluir
                      </button>
                      <button
                        type="button"
                        onClick={() => ignorarSugestao(candidato)}
                        className="shrink-0 rounded-md p-1 text-amber-700/70 hover:bg-amber-100 hover:text-amber-900 dark:text-amber-200/70 dark:hover:bg-amber-500/10"
                        aria-label="Ignorar sugestão"
                        title="Ignorar"
                      >
                        <X className="h-4 w-4" strokeWidth={2} aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : null}

        {categoriaAtiva === 'imoveis' && sugestoesImoveis.length === 0 && ignorados.size > 0 ? (
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/70 px-4 py-2 text-xs text-slate-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400">
            <span>
              {ignorados.size === 1
                ? '1 sugestão de imóvel foi rejeitada.'
                : `${ignorados.size} sugestões de imóveis foram rejeitadas.`}
            </span>
            <button
              type="button"
              onClick={atualizarSugestoes}
              className="ml-auto flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.06]"
            >
              <RefreshCw className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              Atualizar sugestões
            </button>
          </div>
        ) : null}

        {form ? (
          <FormularioPatrimonio
            config={config}
            cores={cores}
            form={form}
            onChange={(name, value) => setForm((f) => ({ ...f, [name]: value }))}
            onSubmit={salvar}
            onCancel={fecharForm}
            buscaImovel={categoriaAtiva === 'imoveis' ? buscarImovelCadastroPorNumero : null}
          />
        ) : null}

        <div className="rounded-2xl border border-slate-200 bg-white/95 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
          {lista.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
              Nenhum item cadastrado em {config.label.toLowerCase()}.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-white/[0.06]">
              {lista.map((item) => (
                <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 dark:bg-white/[0.06] ${cores.icone}`}
                  >
                    <config.Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-slate-800 dark:text-slate-100">
                      {item.descricao || config.singular}
                    </div>
                    {config.subtitulo(item) ? (
                      <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {config.subtitulo(item)}
                      </div>
                    ) : null}
                  </div>
                  <div className={`shrink-0 text-right font-semibold ${cores.total}`}>
                    {formatarMoeda(item.valor)}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => abrirEdicao(item)}
                      className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-white/[0.06]"
                      aria-label="Editar"
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" strokeWidth={2} aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => remover(item)}
                      className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-500/10"
                      aria-label="Remover"
                      title="Remover"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={2} aria-hidden />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function FormularioPatrimonio({ config, cores, form, onChange, onSubmit, onCancel, buscaImovel }) {
  const [numeroImovel, setNumeroImovel] = useState('');
  const [buscaMsg, setBuscaMsg] = useState(null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKey);
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = anterior;
    };
  }, [onCancel]);

  const handleBuscarImovel = () => {
    const candidato = buscaImovel?.(numeroImovel);
    if (!candidato) {
      setBuscaMsg({ tipo: 'erro', texto: 'Nenhum imóvel encontrado com esse número no cadastro.' });
      return;
    }
    onChange('descricao', candidato.descricao);
    onChange('tipo', candidato.tipo);
    onChange('endereco', candidato.endereco);
    onChange('matricula', candidato.matricula);
    onChange('origemImovelId', candidato.origemImovelId);
    setBuscaMsg({ tipo: 'ok', texto: `Imóvel carregado: ${candidato.descricao}` });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden
      />
      <form
        onSubmit={onSubmit}
        className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-900"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {form.id ? `Editar ${config.singular.toLowerCase()}` : `Novo ${config.singular.toLowerCase()}`}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/[0.06]"
            aria-label="Fechar formulário"
          >
            <X className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
        </div>
        {buscaImovel ? (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-500/20 dark:bg-emerald-500/[0.06]">
            <label className="mb-1 block text-xs font-medium text-emerald-800 dark:text-emerald-200">
              Adicionar pelo número do imóvel (cadastro de imóveis)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={numeroImovel}
                onChange={(e) => setNumeroImovel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleBuscarImovel();
                  }
                }}
                placeholder="Ex.: 12"
                className="w-32 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-100"
              />
              <button
                type="button"
                onClick={handleBuscarImovel}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                <Search className="h-4 w-4" strokeWidth={2} aria-hidden />
                Buscar
              </button>
            </div>
            {buscaMsg ? (
              <p
                className={`mt-1.5 text-xs ${
                  buscaMsg.tipo === 'ok'
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                {buscaMsg.texto}
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {config.campos.map((campo) => (
            <div key={campo.name} className={campo.largo ? 'sm:col-span-2' : ''}>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
                {campo.label}
              </label>
              {campo.tipo === 'moeda' ? (
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                    R$
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={form[campo.name] ?? ''}
                    onChange={(e) => onChange(campo.name, e.target.value)}
                    placeholder={campo.placeholder}
                    className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-100 dark:focus:ring-white/10"
                  />
                </div>
              ) : (
                <input
                  type={campo.tipo === 'date' ? 'date' : 'text'}
                  value={form[campo.name] ?? ''}
                  onChange={(e) => onChange(campo.name, e.target.value)}
                  placeholder={campo.placeholder}
                  required={campo.principal}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-100 dark:focus:ring-white/10"
                />
              )}
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.06]"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors ${cores.botao}`}
          >
            Salvar
          </button>
        </div>
      </form>
    </div>
  );
}

/** Converte texto digitado (ex.: "1.250,50" ou "1250.50") em número. */
function parseValorMoeda(valor) {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0;
  const txt = String(valor ?? '').trim();
  if (!txt) return 0;
  let normalizado = txt.replace(/[^\d.,-]/g, '');
  if (normalizado.includes(',')) {
    normalizado = normalizado.replace(/\./g, '').replace(',', '.');
  }
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : 0;
}
