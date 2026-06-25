import { useEffect, useRef, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { buscarCliente, pesquisarCadastroPessoasPorNomeOuCpf } from '../../api/clientesService.js';
import { rotuloPessoaComDocumento } from '../../services/qualificacaoContratualHelper.js';
import { imoveisInputClass } from './ImoveisAdminLayout.jsx';

function pareceNumeroPessoa(termo) {
  const t = String(termo ?? '').trim().replace(/\s+/g, '');
  if (!/^\d+$/.test(t)) return false;
  const n = Math.floor(Number(t));
  return Number.isFinite(n) && n >= 1 && t.length <= 10;
}

/**
 * Busca pessoa no cadastro e devolve snapshot para vincular proprietário/inquilino do imóvel.
 * @param {{
 *   onChange: (pessoa: { id: number, nome?: string, cpf?: string, telefone?: string } | null) => void,
 *   disabled?: boolean,
 * }} props
 */
export function SeletorPessoaParteImovel({ onChange, disabled = false }) {
  const [termo, setTermo] = useState('');
  const [aberto, setAberto] = useState(false);
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    const t = termo.trim();
    if (!t) {
      setResultados([]);
      setBuscando(false);
      return undefined;
    }

    let cancelado = false;
    const timer = window.setTimeout(async () => {
      setBuscando(true);
      try {
        const merged = [];
        if (pareceNumeroPessoa(t)) {
          const id = Math.floor(Number(t.replace(/\D/g, '')));
          const direct = await buscarCliente(id);
          if (direct?.id != null) merged.push(direct);
        }
        const arr = await pesquisarCadastroPessoasPorNomeOuCpf(t, {
          apenasAtivos: false,
          limite: 30,
        });
        for (const p of arr || []) {
          if (!merged.some((x) => Number(x.id) === Number(p.id))) merged.push(p);
        }
        if (!cancelado) setResultados(merged.filter((p) => Number(p.id) >= 1));
      } catch {
        if (!cancelado) setResultados([]);
      } finally {
        if (!cancelado) setBuscando(false);
      }
    }, 280);

    return () => {
      cancelado = true;
      window.clearTimeout(timer);
    };
  }, [termo]);

  useEffect(() => {
    function onDocMouseDown(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setAberto(false);
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  function selecionar(p) {
    onChange({
      id: Number(p.id),
      nome: p.nome ?? '',
      cpf: p.cpf ?? '',
      telefone: p.telefone ?? '',
    });
    setTermo('');
    setAberto(false);
  }

  const mostrarLista = aberto && !disabled && termo.trim().length > 0;

  return (
    <div ref={rootRef} className="relative w-full">
      <label className="block">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">
          Buscar pessoa (nome, CPF/CNPJ ou nº)
        </span>
        <div className="flex rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1018] overflow-hidden focus-within:ring-2 focus-within:ring-teal-500/40">
          <span className="pl-2.5 flex items-center text-slate-400">
            {buscando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </span>
          <input
            type="search"
            disabled={disabled}
            value={termo}
            placeholder="Ex.: Franciele, CPF ou 6937"
            onChange={(e) => {
              setTermo(e.target.value);
              setAberto(true);
            }}
            onFocus={() => setAberto(true)}
            className={`${imoveisInputClass} border-0 rounded-none focus:ring-0 shadow-none`}
            autoComplete="off"
          />
        </div>
      </label>
      {mostrarLista && resultados.length > 0 ? (
        <ul
          className="absolute z-50 mt-1 max-h-52 w-full overflow-auto rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#141c2c] shadow-lg text-sm"
          role="listbox"
        >
          {resultados.slice(0, 40).map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-teal-50 dark:hover:bg-teal-950/30 text-slate-800 dark:text-slate-100"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selecionar(p)}
              >
                {rotuloPessoaComDocumento(p)}
                <span className="text-slate-400 text-xs ml-1">#{p.id}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {mostrarLista && !buscando && resultados.length === 0 ? (
        <p className="absolute z-50 mt-1 w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#141c2c] shadow-lg text-sm px-3 py-2 text-slate-500">
          Nenhuma pessoa encontrada para «{termo.trim()}».
        </p>
      ) : null}
    </div>
  );
}
