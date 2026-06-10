import { useMemo, useState, useRef, useEffect } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { buscarCliente, pesquisarCadastroPessoasPorNomeOuCpf } from '../../api/clientesService.js';
import { rotuloPessoaComDocumento, inferirTipoPessoaPorDocumento } from '../../services/qualificacaoContratualHelper.js';

function pareceNumeroPessoa(termo) {
  const t = String(termo ?? '').trim().replace(/\s+/g, '');
  if (!/^\d+$/.test(t)) return false;
  const n = Math.floor(Number(t));
  return Number.isFinite(n) && n >= 1 && t.length <= 10;
}

function ordenarCandidatos(candidatos, termo) {
  const t = String(termo ?? '').trim().replace(/\D/g, '');
  const idAlvo = pareceNumeroPessoa(termo) ? Math.floor(Number(t)) : null;
  return [...candidatos].sort((a, b) => {
    const idA = Number(a.id);
    const idB = Number(b.id);
    if (idAlvo != null) {
      if (idA === idAlvo && idB !== idAlvo) return -1;
      if (idB === idAlvo && idA !== idAlvo) return 1;
    }
    return idA - idB;
  });
}

/**
 * Busca e seleção de outra pessoa cadastrada como responsável / representante.
 * @param {object} props
 * @param {Array<{id:number|string,nome?:string,cpf?:string}>} props.pessoas - cache local opcional
 * @param {number|string|null|undefined} props.valueId - ID da pessoa responsável ou vazio
 * @param {(id: number|null, snapshot: object|null) => void} props.onChange - snapshot: { id, nome, cpf, tipoPessoa }
 * @param {number|string|null|undefined} props.excluirId - não oferecer a própria ficha em edição
 * @param {boolean} props.disabled
 * @param {boolean} [props.ehPessoaJuridica] — ajusta rótulos (administrador PJ vs representante PF)
 * @param {string} [props.className]
 */
export function SeletorResponsavelPessoa({
  pessoas = [],
  valueId,
  onChange,
  excluirId,
  disabled,
  ehPessoaJuridica = false,
  className = '',
}) {
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState('');
  const [resultadosApi, setResultadosApi] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [selecionadaCache, setSelecionadaCache] = useState(null);
  const rootRef = useRef(null);

  const idExcl = excluirId != null && excluirId !== '' ? Number(excluirId) : null;

  const selecionada = useMemo(() => {
    const vid = valueId != null && valueId !== '' ? Number(valueId) : null;
    if (vid == null || !Number.isFinite(vid)) return null;
    return (
      (pessoas || []).find((p) => Number(p.id) === vid)
      ?? (selecionadaCache && Number(selecionadaCache.id) === vid ? selecionadaCache : null)
    );
  }, [pessoas, valueId, selecionadaCache]);

  useEffect(() => {
    const vid = valueId != null && valueId !== '' ? Number(valueId) : null;
    if (vid == null || !Number.isFinite(vid)) {
      setSelecionadaCache(null);
      return undefined;
    }
    const inList = (pessoas || []).find((p) => Number(p.id) === vid);
    if (inList) {
      setSelecionadaCache(inList);
      return undefined;
    }
    let cancelled = false;
    void buscarCliente(vid).then((p) => {
      if (!cancelled) setSelecionadaCache(p || null);
    });
    return () => {
      cancelled = true;
    };
  }, [valueId, pessoas]);

  useEffect(() => {
    const t = termo.trim();
    if (!t || t.length < 1) {
      setResultadosApi([]);
      setBuscando(false);
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setBuscando(true);
      try {
        /** @type {Array<{id:number|string,nome?:string,cpf?:string}>} */
        const merged = [];

        if (pareceNumeroPessoa(t)) {
          const id = Math.floor(Number(t.replace(/\D/g, '')));
          const direct = await buscarCliente(id);
          if (direct?.id != null) merged.push(direct);
        }

        const arr = await pesquisarCadastroPessoasPorNomeOuCpf(t, {
          apenasAtivos: false,
          limite: 40,
        });
        for (const p of arr || []) {
          if (!merged.some((x) => Number(x.id) === Number(p.id))) merged.push(p);
        }

        const filtrados = merged.filter((p) => {
          const id = Number(p.id);
          if (!Number.isFinite(id) || id < 1) return false;
          if (idExcl != null && id === idExcl) return false;
          return true;
        });

        if (!cancelled) {
          setResultadosApi(ordenarCandidatos(filtrados, t));
        }
      } catch {
        if (!cancelled) setResultadosApi([]);
      } finally {
        if (!cancelled) setBuscando(false);
      }
    }, 280);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [termo, idExcl]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setAberto(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function selecionar(p) {
    const id = Number(p.id);
    const snapshot = {
      id,
      nome: p.nome ?? '',
      cpf: p.cpf ?? '',
      tipoPessoa: p.tipoPessoa ?? inferirTipoPessoaPorDocumento(p.cpf),
    };
    setSelecionadaCache(p);
    onChange(id, snapshot);
    setTermo('');
    setAberto(false);
  }

  function limpar() {
    setSelecionadaCache(null);
    onChange(null, null);
    setTermo('');
    setAberto(false);
  }

  const termoAtivo = termo.trim().length > 0;
  const mostrarLista = aberto && !disabled && termoAtivo;

  const rotuloCampo = ehPessoaJuridica
    ? 'Administrador / representante vinculado'
    : 'Pessoa responsável / representante';
  const ajudaCampo = ehPessoaJuridica
    ? 'Vincule outra pessoa cadastrada como administrador(a) desta PJ. Na qualificação contratual entra «neste ato representada por seu administrador» + qualificação completa do vinculado. Busque pelo nº da pessoa (ex.: 7193), nome ou CPF/CNPJ.'
    : 'Vincule outro cadastro como representante legal, tutor, curador etc. Busque pelo nº da pessoa, nome ou CPF/CNPJ.';

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {rotuloCampo}
        <span className="text-slate-400 font-normal"> (opcional)</span>
      </label>
      <div className="flex gap-2 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <div className="flex rounded-lg border border-slate-300 bg-white overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
            <span className="pl-2 flex items-center text-slate-400">
              {buscando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </span>
            <input
              type="text"
              disabled={disabled}
              placeholder="Buscar por nome, CPF/CNPJ ou nº da pessoa…"
              value={termo}
              onChange={(e) => {
                setTermo(e.target.value);
                setAberto(true);
              }}
              onFocus={() => setAberto(true)}
              className="w-full px-2 py-2 text-sm border-0 focus:ring-0 disabled:bg-slate-100"
            />
          </div>
          {mostrarLista && resultadosApi.length > 0 && (
            <ul
              className="absolute z-40 mt-1 max-h-52 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg text-sm"
              role="listbox"
            >
              {resultadosApi.slice(0, 50).map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-800"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selecionar(p)}
                  >
                    {rotuloPessoaComDocumento(p)}
                    <span className="text-slate-400 text-xs ml-1">#{p.id}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {mostrarLista && !buscando && resultadosApi.length === 0 && (
            <p className="absolute z-40 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg text-sm px-3 py-2 text-slate-500">
              Nenhuma pessoa encontrada para «{termo.trim()}».
            </p>
          )}
        </div>
        {(valueId != null && valueId !== '') || selecionada ? (
          <button
            type="button"
            disabled={disabled}
            onClick={limpar}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50 disabled:opacity-50"
            title="Remover vínculo de responsável"
          >
            <X className="w-4 h-4" />
            Limpar
          </button>
        ) : null}
      </div>
      {selecionada && (
        <p className="text-xs text-slate-600 mt-1.5">
          Vínculo atual: <strong>{rotuloPessoaComDocumento(selecionada)}</strong>
          <span className="text-slate-400 ml-1">#{selecionada.id}</span>
        </p>
      )}
      <p className="text-xs text-slate-500 mt-1">{ajudaCampo}</p>
    </div>
  );
}
