import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { X, ChevronUp, ChevronDown, UserPlus, Landmark, Search, FileSpreadsheet } from 'lucide-react';
import { padCliente } from '../data/processosDadosRelatorio.js';
import { resolverAliasHojeEmTexto } from '../services/hjDateAliasService.js';
import {
  carregarImovelCadastro,
  carregarImovelCadastroPorNumeroPlanilha,
  listarImoveisApi,
  salvarImovelCadastro,
} from '../repositories/imoveisRepository.js';
import { featureFlags } from '../config/featureFlags.js';
import { buildRouterStateChaveClienteProcesso } from '../domain/camposProcessoCliente.js';

function Field({ label, children, className = '' }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5 tracking-tight">{label}</label>
      {children}
    </div>
  );
}

const utilAccentTop = {
  agua: 'border-t-sky-500/70 dark:border-t-sky-400/55',
  energia: 'border-t-violet-500/70 dark:border-t-violet-400/50',
  gas: 'border-t-emerald-500/70 dark:border-t-emerald-400/50',
  contrato: 'border-t-amber-500/70 dark:border-t-amber-400/45',
  cond: 'border-t-orange-400/80 dark:border-t-orange-300/45',
};

/** Coluna (Água / Energia / …): card com faixa superior de cor e hierarquia clara. */
function BlocoUtilidade({ titulo, accent = 'agua', children }) {
  const top = utilAccentTop[accent] || utilAccentTop.agua;
  return (
    <div
      className={`rounded-xl border border-slate-200/90 dark:border-white/[0.08] bg-slate-50/95 dark:bg-[#161f2e] p-4 shadow-sm dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] flex flex-col gap-3 min-h-0 border-t-[3px] ${top}`}
    >
      <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider border-b border-slate-200/90 dark:border-white/[0.07] pb-2.5 shrink-0">
        {titulo}
      </p>
      <div className="space-y-3 flex-1 min-w-0">{children}</div>
    </div>
  );
}

const inputClass =
  'w-full px-3 py-2.5 text-sm rounded-xl border border-slate-300/90 dark:border-white/[0.1] bg-white dark:bg-[#141c2c] text-slate-900 dark:text-slate-100 shadow-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 dark:focus:ring-cyan-400/20 focus:border-cyan-500/55 dark:focus:border-cyan-400/35 transition-[box-shadow,border-color] duration-200';

const sectionHeading =
  'text-base font-semibold text-slate-800 dark:text-slate-100 tracking-tight pb-3 mb-0 border-b border-slate-200/90 dark:border-white/[0.08]';

const btnPrimary =
  'inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-b from-cyan-600 to-teal-700 dark:from-cyan-600 dark:to-teal-800 border border-cyan-500/40 shadow-md shadow-cyan-950/25 hover:brightness-110 active:scale-[0.99] transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none';

const btnSecondary =
  'inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-medium border border-slate-300/90 dark:border-white/[0.12] bg-white dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.08] active:scale-[0.99] transition-all duration-200';

const btnTealOutline =
  'inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold border border-teal-500/50 dark:border-teal-400/40 bg-teal-50/90 dark:bg-teal-500/10 text-teal-900 dark:text-teal-100 hover:bg-teal-100/90 dark:hover:bg-teal-500/18 disabled:opacity-45 disabled:cursor-not-allowed transition-all duration-200 shadow-sm dark:shadow-teal-950/20';

const btnIconGhost =
  'p-2.5 rounded-xl border border-slate-300/90 dark:border-white/[0.1] bg-white dark:bg-white/[0.04] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.08] transition-colors shrink-0';

function textoSemAcentoMin(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Pesquisa nos campos condomínio e unidade: cada palavra deve aparecer em qualquer um dos dois (E entre tokens). */
function imovelCondUnidadeCorresponde(imovelApi, queryBruta) {
  const q = String(queryBruta ?? '').trim();
  if (!q) return false;
  const hay = `${textoSemAcentoMin(imovelApi?.condominio)} ${textoSemAcentoMin(imovelApi?.unidade)}`.trim();
  const tokens = textoSemAcentoMin(q)
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return false;
  return tokens.every((t) => hay.includes(t));
}

export function Imoveis() {
  const location = useLocation();
  const navigate = useNavigate();
  const [imovelId, setImovelId] = useState(43);
  const [imovelOcupado, setImovelOcupado] = useState(true);
  const [codigo, setCodigo] = useState('938');
  const [proc, setProc] = useState(42);
  const [observacoesInquilino, setObservacoesInquilino] = useState('');
  const [endereco, setEndereco] = useState('Rua L-17, Quadra 06, Lote 01, Apartamento 1101, Bloco C, Residencial Veredas');
  const [condominio, setCondominio] = useState('Veredas do Bosque');
  const [unidade, setUnidade] = useState('Unidade 1101 C');
  const [garagens, setGaragens] = useState('2');
  const [garantia, setGarantia] = useState('Fiador');
  const [valorGarantia, setValorGarantia] = useState('0');
  const [valorLocacao, setValorLocacao] = useState('1700');
  const [diaPagAluguel, setDiaPagAluguel] = useState('04');
  const [dataPag1TxCond, setDataPag1TxCond] = useState('');
  const [inscricaoImobiliaria, setInscricaoImobiliaria] = useState('101.406.0332.243');
  const [existeDebIptu, setExisteDebIptu] = useState('NÃO');
  const [dataConsIptu, setDataConsIptu] = useState('16/09/2025');
  const [aguaNumero, setAguaNumero] = useState('2178297-0');
  const [dataConsAgua, setDataConsAgua] = useState('');
  const [existeDebAgua, setExisteDebAgua] = useState('');
  const [diaVencAgua, setDiaVencAgua] = useState('');
  const [energiaNumero, setEnergiaNumero] = useState('10020482610');
  const [dataConsEnergia, setDataConsEnergia] = useState('');
  const [existeDebEnergia, setExisteDebEnergia] = useState('');
  const [diaVencEnergia, setDiaVencEnergia] = useState('');
  const [gasNumero, setGasNumero] = useState('1091705 - 39');
  const [dataConsGas, setDataConsGas] = useState('');
  const [existeDebGas, setExisteDebGas] = useState('');
  const [diaVencGas, setDiaVencGas] = useState('');
  const [dataInicioContrato, setDataInicioContrato] = useState('04/03/2026');
  const [dataFimContrato, setDataFimContrato] = useState('12/02/2026');
  const [dataConsDebitoCond, setDataConsDebitoCond] = useState('');
  const [existeDebitoCond, setExisteDebitoCond] = useState('');
  const [diaRepasse, setDiaRepasse] = useState('20');
  const [banco, setBanco] = useState('');
  const [agencia, setAgencia] = useState('');
  const [numeroBanco, setNumeroBanco] = useState('');
  const [conta, setConta] = useState('');
  const [cpfBanco, setCpfBanco] = useState('');
  const [titular, setTitular] = useState('');
  const [chavePix, setChavePix] = useState('');
  const [proprietarioNumeroPessoa, setProprietarioNumeroPessoa] = useState('');
  const [proprietario, setProprietario] = useState('ITAMAR ALEXANDRE FELIX VILLA REAL JUNIOR');
  const [proprietarioCpf, setProprietarioCpf] = useState('007.332.351-90');
  const [proprietarioContato, setProprietarioContato] = useState('62-8234-5000 // 62 3018-6998');
  const [linkVistoria, setLinkVistoria] = useState('https://www.drop');
  const [inquilinoNumeroPessoa, setInquilinoNumeroPessoa] = useState('');
  const [inquilino, setInquilino] = useState('ROSANGELA APARECIDA DA SILVA');
  const [inquilinoCpf, setInquilinoCpf] = useState('765.529.341-49');
  const [inquilinoContato, setInquilinoContato] = useState('62 99247-4815');
  const [showModalIptu, setShowModalIptu] = useState(false);
  const [infoIptuTexto, setInfoIptuTexto] = useState('IPTU 2025 cinco parcelas em atraso + duas à vencer R$1.323,30');
  const [showModalContrato, setShowModalContrato] = useState(false);
  const [contratoAssinadoInquilino, setContratoAssinadoInquilino] = useState('nao');
  const [contratoAssinadoProprietario, setContratoAssinadoProprietario] = useState('nao');
  const [contratoAssinadoGarantidor, setContratoAssinadoGarantidor] = useState('nao');
  const [contratoAssinadoTestemunhas, setContratoAssinadoTestemunhas] = useState('nao');
  const [contratoArquivado, setContratoArquivado] = useState('nao');
  const [contratoIntermediacaoArquivado, setContratoIntermediacaoArquivado] = useState('nao');
  const [contratoIntermediacaoAssinadoProprietario, setContratoIntermediacaoAssinadoProprietario] = useState('nao');
  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [apiSaving, setApiSaving] = useState(false);
  const [apiSuccess, setApiSuccess] = useState('');
  const [_apiImovelId, setApiImovelId] = useState(null);
  const [_apiContratoId, setApiContratoId] = useState(null);
  const [_apiClienteId, setApiClienteId] = useState(null);
  const [_apiProcessoId, setApiProcessoId] = useState(null);
  const unidadeAlvo = location.state && typeof location.state === 'object' ? location.state.unidade : null;

  const [pesquisaCondUnidade, setPesquisaCondUnidade] = useState('');
  const [listaImoveisPesquisa, setListaImoveisPesquisa] = useState([]);

  useEffect(() => {
    if (!featureFlags.useApiImoveis) return undefined;
    let ativo = true;
    void listarImoveisApi().then((list) => {
      if (ativo) setListaImoveisPesquisa(Array.isArray(list) ? list : []);
    });
    return () => {
      ativo = false;
    };
  }, []);

  const resultadosPesquisaCondUnidade = useMemo(() => {
    if (!featureFlags.useApiImoveis || !pesquisaCondUnidade.trim()) return [];
    return listaImoveisPesquisa.filter((im) => imovelCondUnidadeCorresponde(im, pesquisaCondUnidade));
  }, [listaImoveisPesquisa, pesquisaCondUnidade]);

  function popularFormulario(data) {
    if (!data) {
      // Sem cadastro para este nº de imóvel: formulário em branco (não manter dados do imóvel anterior).
      setImovelOcupado(false);
      setCodigo('');
      setProc('');
      setObservacoesInquilino('');
      setEndereco('');
      setCondominio('');
      setUnidade('');
      setGaragens('');
      setGarantia('');
      setValorGarantia('');
      setValorLocacao('');
      setDiaPagAluguel('');
      setDataPag1TxCond('');
      setInscricaoImobiliaria('');
      setExisteDebIptu('');
      setDataConsIptu('');
      setAguaNumero('');
      setDataConsAgua('');
      setExisteDebAgua('');
      setDiaVencAgua('');
      setEnergiaNumero('');
      setDataConsEnergia('');
      setExisteDebEnergia('');
      setDiaVencEnergia('');
      setGasNumero('');
      setDataConsGas('');
      setExisteDebGas('');
      setDiaVencGas('');
      setDataInicioContrato('');
      setDataFimContrato('');
      setDataConsDebitoCond('');
      setExisteDebitoCond('');
      setDiaRepasse('');
      setBanco('');
      setAgencia('');
      setNumeroBanco('');
      setConta('');
      setCpfBanco('');
      setTitular('');
      setChavePix('');
      setProprietario('');
      setProprietarioCpf('');
      setProprietarioContato('');
      setLinkVistoria('');
      setInquilino('');
      setInquilinoCpf('');
      setInquilinoContato('');
      setInfoIptuTexto('');
      setContratoAssinadoInquilino('nao');
      setContratoAssinadoProprietario('nao');
      setContratoAssinadoGarantidor('nao');
      setContratoAssinadoTestemunhas('nao');
      setContratoArquivado('nao');
      setContratoIntermediacaoArquivado('nao');
      setContratoIntermediacaoAssinadoProprietario('nao');
      setApiImovelId(null);
      setApiContratoId(null);
      setApiClienteId(null);
      setApiProcessoId(null);
      return;
    }

    setImovelOcupado(!!data.imovelOcupado);
    setCodigo(String(data.codigo ?? ''));
    setProc(Number(data.proc ?? 1));
    setObservacoesInquilino(String(data.observacoesInquilino ?? ''));
    setEndereco(String(data.endereco ?? ''));
    setCondominio(String(data.condominio ?? ''));
    setUnidade(String(data.unidade ?? ''));
    if (unidadeAlvo != null) setUnidade(String(unidadeAlvo));
    setGaragens(String(data.garagens ?? ''));
    setGarantia(String(data.garantia ?? ''));
    setValorGarantia(String(data.valorGarantia ?? ''));
    setValorLocacao(String(data.valorLocacao ?? ''));
    setDiaPagAluguel(String(data.diaPagAluguel ?? ''));
    setDataPag1TxCond(String(data.dataPag1TxCond ?? ''));
    setInscricaoImobiliaria(String(data.inscricaoImobiliaria ?? ''));
    setExisteDebIptu(String(data.existeDebIptu ?? ''));
    setDataConsIptu(String(data.dataConsIptu ?? ''));
    setAguaNumero(String(data.aguaNumero ?? ''));
    setDataConsAgua(String(data.dataConsAgua ?? ''));
    setExisteDebAgua(String(data.existeDebAgua ?? ''));
    setDiaVencAgua(String(data.diaVencAgua ?? ''));
    setEnergiaNumero(String(data.energiaNumero ?? ''));
    setDataConsEnergia(String(data.dataConsEnergia ?? ''));
    setExisteDebEnergia(String(data.existeDebEnergia ?? ''));
    setDiaVencEnergia(String(data.diaVencEnergia ?? ''));
    setGasNumero(String(data.gasNumero ?? ''));
    setDataConsGas(String(data.dataConsGas ?? ''));
    setExisteDebGas(String(data.existeDebGas ?? ''));
    setDiaVencGas(String(data.diaVencGas ?? ''));
    setDataInicioContrato(String(data.dataInicioContrato ?? ''));
    setDataFimContrato(String(data.dataFimContrato ?? ''));
    setDataConsDebitoCond(String(data.dataConsDebitoCond ?? ''));
    setExisteDebitoCond(String(data.existeDebitoCond ?? ''));
    setDiaRepasse(String(data.diaRepasse ?? ''));
    setBanco(String(data.banco ?? ''));
    setAgencia(String(data.agencia ?? ''));
    setNumeroBanco(String(data.numeroBanco ?? ''));
    setConta(String(data.conta ?? ''));
    setCpfBanco(String(data.cpfBanco ?? ''));
    setTitular(String(data.titular ?? ''));
    setChavePix(String(data.chavePix ?? ''));
    setProprietarioNumeroPessoa(String(data.proprietarioNumeroPessoa ?? ''));
    setProprietario(String(data.proprietario ?? ''));
    setProprietarioCpf(String(data.proprietarioCpf ?? ''));
    setProprietarioContato(String(data.proprietarioContato ?? ''));
    setLinkVistoria(String(data.linkVistoria ?? ''));
    setInquilinoNumeroPessoa(String(data.inquilinoNumeroPessoa ?? ''));
    setInquilino(String(data.inquilino ?? ''));
    setInquilinoCpf(String(data.inquilinoCpf ?? ''));
    setInquilinoContato(String(data.inquilinoContato ?? ''));
    setInfoIptuTexto(String(data.infoIptuTexto ?? ''));
    setContratoAssinadoInquilino(String(data.contratoAssinadoInquilino ?? 'nao'));
    setContratoAssinadoProprietario(String(data.contratoAssinadoProprietario ?? 'nao'));
    setContratoAssinadoGarantidor(String(data.contratoAssinadoGarantidor ?? 'nao'));
    setContratoAssinadoTestemunhas(String(data.contratoAssinadoTestemunhas ?? 'nao'));
    setContratoArquivado(String(data.contratoArquivado ?? 'nao'));
    setContratoIntermediacaoArquivado(String(data.contratoIntermediacaoArquivado ?? 'nao'));
    setContratoIntermediacaoAssinadoProprietario(String(data.contratoIntermediacaoAssinadoProprietario ?? 'nao'));
    setApiImovelId(data._apiImovelId ?? null);
    setApiContratoId(data._apiContratoId ?? null);
    setApiClienteId(data._apiClienteId ?? null);
    setApiProcessoId(data._apiProcessoId ?? null);
  }

  useEffect(() => {
    let ativo = true;
    setApiError('');
    setApiSuccess('');
    setApiLoading(true);

    void (async () => {
      try {
        const state = location.state && typeof location.state === 'object' ? location.state : null;
        const np = state?.numeroPlanilha != null ? Number(state.numeroPlanilha) : null;

        if (featureFlags.useApiImoveis && Number.isFinite(np) && np >= 1) {
          const porPlanilha = await carregarImovelCadastroPorNumeroPlanilha(np);
          if (!ativo) return;
          if (porPlanilha.item) {
            popularFormulario(porPlanilha.item);
            const idUi = Number(porPlanilha.item.imovelId);
            if (Number.isFinite(idUi) && idUi > 0 && idUi !== imovelId) {
              setImovelId(idUi);
            }
            return;
          }
        }

        if (featureFlags.useApiImoveis) {
          const porPlanilha = await carregarImovelCadastroPorNumeroPlanilha(imovelId);
          if (!ativo) return;
          if (porPlanilha.item) {
            popularFormulario(porPlanilha.item);
            const sync = Number(porPlanilha.item.imovelId);
            if (Number.isFinite(sync) && sync > 0 && sync !== imovelId) {
              setImovelId(sync);
            }
            return;
          }
        }

        const r = await carregarImovelCadastro({ imovelId });
        if (!ativo) return;
        if (r.item) {
          popularFormulario(r.item);
          return;
        }

        if (featureFlags.useApiImoveis) {
          const lista = await listarImoveisApi();
          if (!ativo) return;
          if (lista.length > 0) {
            const first =
              lista[0].numeroPlanilha != null ? Number(lista[0].numeroPlanilha) : Number(lista[0].id);
            if (Number.isFinite(first) && first > 0 && first !== imovelId) {
              setImovelId(first);
              return;
            }
          }
          popularFormulario(null);
          setApiError(
            lista.length === 0
              ? 'Nenhum imóvel no banco. Rode o import do imoveis.xlsx (job Java) ou preencha e salve um novo cadastro.'
              : 'Não foi possível carregar este imóvel pela API.',
          );
          return;
        }

        popularFormulario(null);
      } catch (e) {
        if (!ativo) return;
        popularFormulario(null);
        setApiError(e?.message || 'Falha ao carregar imóvel.');
      } finally {
        if (ativo) setApiLoading(false);
      }
    })();

    return () => {
      ativo = false;
    };
  }, [imovelId, unidadeAlvo, location.key, location.state]);

  useEffect(() => {
    const state = location.state && typeof location.state === 'object' ? location.state : null;
    const npNav = state?.numeroPlanilha != null ? Number(state.numeroPlanilha) : null;
    if (Number.isFinite(npNav) && npNav >= 1) {
      setImovelId(npNav);
      return;
    }
    const nextImovelId = state?.imovelId != null ? Number(state.imovelId) : null;
    if (!Number.isFinite(nextImovelId) || nextImovelId <= 0) return;
    setImovelId(nextImovelId);
  }, [location.key, location.state]);

  function abrirProcessoDoImovel() {
    navigate('/processos', {
      state: buildRouterStateChaveClienteProcesso(padCliente(codigo ?? ''), proc ?? '', {
        /** Mesmo nº deste cadastro — Processos usa getImovelMock(imovelId) como fonte única. */
        imovelId: String(imovelId),
      }),
    });
  }

  const vinculoClienteProcOk =
    String(codigo ?? '').trim() !== '' && String(proc ?? '').trim() !== '';

  async function salvarCadastroAtual() {
    setApiError('');
    setApiSuccess('');
    setApiSaving(true);
    try {
      const r = await salvarImovelCadastro({
        imovelId,
        imovelOcupado,
        codigo,
        proc,
        observacoesInquilino,
        endereco,
        condominio,
        unidade,
        garagens,
        garantia,
        valorGarantia,
        valorLocacao,
        diaPagAluguel,
        dataPag1TxCond,
        inscricaoImobiliaria,
        existeDebIptu,
        dataConsIptu,
        aguaNumero,
        dataConsAgua,
        existeDebAgua,
        diaVencAgua,
        energiaNumero,
        dataConsEnergia,
        existeDebEnergia,
        diaVencEnergia,
        gasNumero,
        dataConsGas,
        existeDebGas,
        diaVencGas,
        dataInicioContrato,
        dataFimContrato,
        dataConsDebitoCond,
        existeDebitoCond,
        diaRepasse,
        banco,
        agencia,
        numeroBanco,
        conta,
        cpfBanco,
        titular,
        chavePix,
        proprietarioNumeroPessoa,
        proprietario,
        proprietarioCpf,
        proprietarioContato,
        linkVistoria,
        inquilinoNumeroPessoa,
        inquilino,
        inquilinoCpf,
        inquilinoContato,
        infoIptuTexto,
        contratoAssinadoInquilino,
        contratoAssinadoProprietario,
        contratoAssinadoGarantidor,
        contratoAssinadoTestemunhas,
        contratoArquivado,
        contratoIntermediacaoArquivado,
        contratoIntermediacaoAssinadoProprietario,
        _apiImovelId,
        _apiContratoId,
      });
      if (r?.item) {
        popularFormulario(r.item);
        setImovelId(Number(r.item.imovelId || imovelId));
      }
      if (featureFlags.useApiImoveis) {
        setApiSuccess('Cadastro do imóvel salvo na API.');
      } else {
        setApiSuccess('Fluxo em fallback legado/mock (sem persistência real).');
      }
    } catch (e) {
      setApiError(e?.message || 'Falha ao salvar cadastro do imóvel.');
    } finally {
      setApiSaving(false);
    }
  }

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-100 via-indigo-50/35 to-emerald-50/45 dark:bg-gradient-to-b dark:from-[#0a0d12] dark:via-[#0c1017] dark:to-[#0e141d]">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-5 py-5 sm:py-7 pb-10">
        <header className="flex items-start justify-between gap-4 mb-6 lg:mb-8">
          <div className="min-w-0 space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-cyan-700 dark:text-cyan-400/90">
              Administração de imóveis
            </p>
            <h1 className="text-2xl sm:text-[1.65rem] font-bold text-slate-800 dark:text-slate-50 tracking-tight">
              Imóveis em Administração
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-3xl leading-relaxed mt-2">
              Cadastro do imóvel, locação, utilidades, conta para repasse e partes.
              {featureFlags.useApiImoveis ? (
                <>
                  {' '}
                  Com a API ativa, o <strong className="text-slate-800 dark:text-slate-200 font-semibold">número do imóvel</strong> no topo é o{' '}
                  <strong className="text-slate-800 dark:text-slate-200 font-semibold">mesmo da coluna A</strong> da planilha de importação. O{' '}
                  <strong className="text-slate-800 dark:text-slate-200 font-semibold">nº Imóvel</strong> em Processos segue o vínculo por código de cliente e proc. Com{' '}
                </>
              ) : (
                <>
                  {' '}
                  O <strong className="text-slate-800 dark:text-slate-200 font-semibold">nº Imóvel</strong> é o mesmo usado na tela{' '}
                  <strong className="text-slate-800 dark:text-slate-200 font-semibold">Processos</strong> (vínculo por código de cliente e proc.). Com{' '}
                </>
              )}
              <strong className="text-slate-800 dark:text-slate-200 font-semibold">Código</strong> e <strong className="text-slate-800 dark:text-slate-200 font-semibold">Proc.</strong> preenchidos, use{' '}
              <strong className="text-slate-800 dark:text-slate-200 font-semibold">Conta Corrente</strong> para ver lançamentos do Financeiro, consolidação mensal e alertas de aluguel/repasse.
            </p>
          </div>
          <div className="flex flex-col gap-2 shrink-0 items-end">
            {featureFlags.useApiImoveis ? (
              <button
                type="button"
                onClick={() => navigate('/relatorio-imoveis')}
                className={`${btnSecondary} inline-flex items-center gap-1.5 text-xs py-2 px-3`}
              >
                <FileSpreadsheet className="w-4 h-4 shrink-0" aria-hidden />
                Relatório de imóveis
              </button>
            ) : null}
            <button type="button" onClick={() => window.history.back()} className={btnIconGhost} aria-label="Fechar">
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="imoveis-admin-sheet bg-white rounded-2xl border border-slate-200/90 dark:border-white/[0.07] shadow-sm overflow-hidden ring-1 ring-slate-900/[0.03] dark:ring-white/[0.04]">
          {(apiLoading || apiError || apiSuccess) && (
            <div className="px-5 py-3 border-b border-slate-200 dark:border-white/[0.08] bg-slate-50/80 dark:bg-white/[0.03] text-sm">
              {apiLoading ? <p className="text-indigo-700 dark:text-indigo-300">Carregando cadastro do imóvel...</p> : null}
              {apiError ? <p className="text-red-700 dark:text-red-300">{apiError}</p> : null}
              {apiSuccess ? <p className="text-emerald-700 dark:text-emerald-300">{apiSuccess}</p> : null}
            </div>
          )}
          {/* Faixa superior: identificação */}
          <div className="imoveis-admin-toolbar px-5 py-4 sm:px-6 border-b border-slate-200 dark:border-white/[0.06] bg-slate-50/95 dark:bg-black/20">
            <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
              <Field
                label={featureFlags.useApiImoveis ? 'Nº (planilha)' : 'Imóvel'}
                className="w-[5.75rem] shrink-0"
              >
                <div className="flex border border-slate-300/90 dark:border-white/[0.12] rounded-xl overflow-hidden bg-white dark:bg-[#141c2c] shadow-sm">
                  <button
                    type="button"
                    className="px-2 py-2.5 border-r border-slate-200 dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-white/[0.05] text-slate-600 dark:text-slate-400 transition-colors"
                    onClick={() => setImovelId((i) => Math.max(1, i - 1))}
                    aria-label="Imóvel anterior"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="number"
                    value={imovelId}
                    onChange={(e) => setImovelId(Number(e.target.value) || 0)}
                    className="w-12 px-1 py-2 text-sm text-center border-0 bg-transparent tabular-nums text-slate-900 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    className="px-2 py-2.5 border-l border-slate-200 dark:border-white/[0.08] hover:bg-slate-50 dark:hover:bg-white/[0.05] text-slate-600 dark:text-slate-400 transition-colors"
                    onClick={() => setImovelId((i) => i + 1)}
                    aria-label="Próximo imóvel"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </Field>

              <fieldset className="border border-slate-300/90 dark:border-white/[0.1] rounded-xl px-4 py-2.5 bg-white dark:bg-[#141c2c]/80 shrink-0 shadow-sm">
                <legend className="text-xs font-semibold text-slate-700 dark:text-slate-300 px-1.5">Imóvel ocupado</legend>
                <div className="flex gap-5 pt-0.5">
                  <label className="flex items-center gap-2 text-sm cursor-pointer text-slate-700 dark:text-slate-200">
                    <input type="radio" name="ocupado" checked={imovelOcupado} onChange={() => setImovelOcupado(true)} className="text-cyan-600" />
                    Sim
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer text-slate-700 dark:text-slate-200">
                    <input type="radio" name="ocupado" checked={!imovelOcupado} onChange={() => setImovelOcupado(false)} className="text-cyan-600" />
                    Não
                  </label>
                </div>
              </fieldset>

              <button type="button" onClick={abrirProcessoDoImovel} className={btnPrimary}>
                Abrir Proc.
              </button>

              <button
                type="button"
                onClick={() =>
                  navigate({
                    pathname: '/imoveis/financeiro',
                    hash: '#extrato-imoveis',
                    state: { imovelId: _apiImovelId ?? imovelId },
                  })
                }
                disabled={!vinculoClienteProcOk || (featureFlags.useApiImoveis && !_apiImovelId)}
                title={
                  !vinculoClienteProcOk
                    ? 'Informe Código e Proc. para vincular ao Cliente e Processo'
                    : featureFlags.useApiImoveis && !_apiImovelId
                      ? 'Salve o cadastro do imóvel na API antes de abrir o financeiro (é necessário o id interno do registro).'
                      : 'Movimentações do Financeiro com o mesmo Cod. cliente e Proc. (conta corrente do processo)'
                }
                className={btnTealOutline}
              >
                <Landmark className="w-4 h-4 shrink-0" aria-hidden />
                Conta Corrente
              </button>

              <Field label="Código" className="w-[5.5rem] shrink-0">
                <input type="text" value={codigo} onChange={(e) => setCodigo(e.target.value)} className={inputClass} />
              </Field>
              <Field label="Proc." className="w-[5.5rem] shrink-0">
                <input type="text" value={proc} onChange={(e) => setProc(e.target.value)} className={inputClass} />
              </Field>
            </div>

            {featureFlags.useApiImoveis ? (
              <div className="mt-4 pt-4 border-t border-slate-200/90 dark:border-white/[0.08] w-full">
                <div className="relative max-w-2xl">
                  <Field label="Pesquisar (condomínio e unidade)">
                    <div className="relative">
                      <Search
                        className="pointer-events-none absolute left-3 top-1/2 z-[1] h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500"
                        aria-hidden
                      />
                      <input
                        type="search"
                        value={pesquisaCondUnidade}
                        onChange={(e) => setPesquisaCondUnidade(e.target.value)}
                        placeholder="Ex.: Veredas 1101 ou nome do condomínio"
                        autoComplete="off"
                        className={`${inputClass} pl-9`}
                        aria-autocomplete="list"
                        aria-controls="imoveis-pesquisa-cond-unidade-listbox"
                        aria-expanded={resultadosPesquisaCondUnidade.length > 0}
                      />
                    </div>
                  </Field>
                  {pesquisaCondUnidade.trim() ? (
                    <ul
                      id="imoveis-pesquisa-cond-unidade-listbox"
                      role="listbox"
                      className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-auto rounded-xl border border-slate-200/95 bg-white py-1 shadow-lg dark:border-white/[0.12] dark:bg-[#141c2c]"
                    >
                      {resultadosPesquisaCondUnidade.length === 0 ? (
                        <li className="px-3 py-2.5 text-sm text-slate-500 dark:text-slate-400">Nenhum imóvel encontrado.</li>
                      ) : (
                        resultadosPesquisaCondUnidade.slice(0, 25).map((im) => (
                          <li key={im.id} role="presentation">
                            <button
                              type="button"
                              role="option"
                              className="flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left text-sm text-slate-800 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-white/[0.08]"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                const n = im.numeroPlanilha != null ? Number(im.numeroPlanilha) : Number(im.id);
                                if (Number.isFinite(n) && n > 0) {
                                  setPesquisaCondUnidade('');
                                  setImovelId(n);
                                }
                              }}
                            >
                              <span className="font-medium text-slate-900 dark:text-slate-50">
                                {im.condominio?.trim() ? im.condominio : '—'}
                                {im.unidade?.trim() ? (
                                  <span className="font-normal text-slate-600 dark:text-slate-400">
                                    {' '}
                                    · {im.unidade}
                                  </span>
                                ) : null}
                              </span>
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                id {im.id}
                                {im.numeroPlanilha != null ? '' : ' · sem nº planilha'}
                              </span>
                            </button>
                          </li>
                        ))
                      )}
                      {resultadosPesquisaCondUnidade.length > 25 ? (
                        <li className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500 dark:border-white/[0.08] dark:text-slate-400">
                          Mostrando 25 de {resultadosPesquisaCondUnidade.length} — refine a pesquisa.
                        </li>
                      ) : null}
                    </ul>
                  ) : null}
                </div>
                <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                  Busca sem acentos; várias palavras restringem o resultado (todas devem constar em condomínio ou unidade).
                </p>
              </div>
            ) : null}

            {featureFlags.useApiImoveis && _apiImovelId ? (
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-3 pt-3 border-t border-slate-200/90 dark:border-white/[0.08] w-full leading-relaxed">
                Referência principal (API): imóvel{' '}
                <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200">{_apiImovelId}</span>
                {_apiContratoId != null ? (
                  <>
                    {' '}
                    · contrato <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200">{_apiContratoId}</span>
                  </>
                ) : null}
                {_apiClienteId != null ? (
                  <>
                    {' '}
                    · cliente <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200">{_apiClienteId}</span>
                  </>
                ) : null}
                {_apiProcessoId != null ? (
                  <>
                    {' '}
                    · processo <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200">{_apiProcessoId}</span>
                  </>
                ) : null}
                . Cod. e Proc. seguem como vínculo com Processos e Financeiro (legado operacional).
              </p>
            ) : null}
          </div>

          <div className="p-5 sm:p-6 md:p-8 space-y-8 md:space-y-10">
            {/* Endereço + observações */}
            <section className="grid grid-cols-1 xl:grid-cols-12 gap-6 lg:gap-8">
              <div className="xl:col-span-8 imoveis-admin-section rounded-2xl border border-slate-200/90 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.02] p-5 sm:p-6 space-y-5 shadow-sm">
                <h2 className={sectionHeading}>Endereço e unidade</h2>
                <Field label="Endereço">
                  <textarea value={endereco} onChange={(e) => setEndereco(e.target.value)} rows={4} className={`${inputClass} resize-y min-h-[5.5rem] leading-relaxed`} />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 sm:gap-5">
                  <Field label="Condomínio" className="sm:col-span-2 lg:col-span-6">
                    <input type="text" value={condominio} onChange={(e) => setCondominio(e.target.value)} className={inputClass} />
                  </Field>
                  <Field label="Unidade" className="lg:col-span-4">
                    <input type="text" value={unidade} onChange={(e) => setUnidade(e.target.value)} className={inputClass} />
                  </Field>
                  <Field label="Garagens" className="lg:col-span-2">
                    <input type="text" value={garagens} onChange={(e) => setGaragens(e.target.value)} className={inputClass} />
                  </Field>
                </div>
              </div>
              <fieldset className="imoveis-admin-obs xl:col-span-4 rounded-2xl border border-amber-200/60 dark:border-amber-500/20 bg-amber-50/40 dark:bg-amber-950/20 p-5 sm:p-6 flex flex-col min-h-[12rem] shadow-md">
                <legend className="text-sm font-semibold text-slate-800 dark:text-amber-100/95 px-1.5">
                  Observações sobre o inquilino
                </legend>
                <p className="text-[11px] text-slate-600 dark:text-amber-200/70 mb-3 leading-snug">
                  Notas internas sobre a locação; leitura confortável em qualquer tema.
                </p>
                <textarea
                  value={observacoesInquilino}
                  onChange={(e) => setObservacoesInquilino(e.target.value)}
                  rows={6}
                  className={`${inputClass} resize-y flex-1 min-h-[9rem] mt-0 bg-white/90 dark:bg-[#0d1018]/70 leading-relaxed`}
                />
              </fieldset>
            </section>

            {/* Garantia, locação, IPTU */}
            <section className="imoveis-admin-section rounded-2xl border border-slate-200/90 dark:border-white/[0.08] bg-slate-50/80 dark:bg-white/[0.025] p-5 sm:p-6 md:p-7 space-y-5 sm:space-y-6 shadow-sm">
              <h2 className={sectionHeading}>Garantia, locação e IPTU</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                <Field label="Garantia">
                  <input type="text" value={garantia} onChange={(e) => setGarantia(e.target.value)} className={inputClass} />
                </Field>
                <Field label="Valor da Garantia">
                  <input type="text" value={valorGarantia} onChange={(e) => setValorGarantia(e.target.value)} className={inputClass} />
                </Field>
                <Field label="Valor da Locação">
                  <input type="text" value={valorLocacao} onChange={(e) => setValorLocacao(e.target.value)} className={inputClass} />
                </Field>
                <Field label="Dia Pag. Aluguel">
                  <input type="text" value={diaPagAluguel} onChange={(e) => setDiaPagAluguel(e.target.value)} className={inputClass} />
                </Field>
              </div>
              <div className="flex flex-wrap items-end gap-3 pt-1">
                <button type="button" className={btnSecondary}>
                  Catálogo
                </button>
                <button type="button" className={btnSecondary}>
                  Doc. Interessados
                </button>
                <Field label="Data pag. 1ª Tx. Cond." className="w-full sm:w-44">
                  <input
                    type="text"
                    value={dataPag1TxCond}
                    onChange={(e) => {
                      const v = e.target.value;
                      setDataPag1TxCond(resolverAliasHojeEmTexto(v, 'br') ?? v);
                    }}
                    placeholder="dd/mm/aaaa ou hj"
                    className={inputClass}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 items-end pt-5 border-t border-slate-200/90 dark:border-white/[0.08]">
                <Field label="Inscrição Imobiliária" className="sm:col-span-2">
                  <input type="text" value={inscricaoImobiliaria} onChange={(e) => setInscricaoImobiliaria(e.target.value)} className={inputClass} />
                </Field>
                <Field label="Existe Deb. IPTU">
                  <input type="text" value={existeDebIptu} onChange={(e) => setExisteDebIptu(e.target.value)} className={inputClass} />
                </Field>
                <Field label="Data Cons.">
                  <input type="text" value={dataConsIptu} onChange={(e) => setDataConsIptu(e.target.value)} className={inputClass} />
                </Field>
                <div className="sm:col-span-2 lg:col-span-1 flex pb-0.5">
                  <button type="button" onClick={() => setShowModalIptu(true)} className={`${btnPrimary} w-full sm:w-auto`}>
                    IPTU
                  </button>
                </div>
              </div>
            </section>

            {/* Cinco colunas: água, energia, gás, contrato, condomínio/repasse */}
            <section className="space-y-5">
              <h2 className={`${sectionHeading} mb-1`}>Água, energia, gás, contrato e condomínio</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 lg:gap-5">
                <BlocoUtilidade titulo="Água" accent="agua">
                  <Field label="Número">
                    <input type="text" value={aguaNumero} onChange={(e) => setAguaNumero(e.target.value)} className={inputClass} />
                  </Field>
                  <Field label="Data cons.">
                    <input type="text" value={dataConsAgua} onChange={(e) => setDataConsAgua(e.target.value)} className={inputClass} />
                  </Field>
                  <Field label="Existe débito">
                    <input type="text" value={existeDebAgua} onChange={(e) => setExisteDebAgua(e.target.value)} className={inputClass} />
                  </Field>
                  <Field label="Dia venc.">
                    <input type="text" value={diaVencAgua} onChange={(e) => setDiaVencAgua(e.target.value)} className={inputClass} />
                  </Field>
                </BlocoUtilidade>
                <BlocoUtilidade titulo="Energia" accent="energia">
                  <Field label="Número">
                    <input type="text" value={energiaNumero} onChange={(e) => setEnergiaNumero(e.target.value)} className={inputClass} />
                  </Field>
                  <Field label="Data cons.">
                    <input type="text" value={dataConsEnergia} onChange={(e) => setDataConsEnergia(e.target.value)} className={inputClass} />
                  </Field>
                  <Field label="Existe débito">
                    <input type="text" value={existeDebEnergia} onChange={(e) => setExisteDebEnergia(e.target.value)} className={inputClass} />
                  </Field>
                  <Field label="Dia venc.">
                    <input type="text" value={diaVencEnergia} onChange={(e) => setDiaVencEnergia(e.target.value)} className={inputClass} />
                  </Field>
                </BlocoUtilidade>
                <BlocoUtilidade titulo="Gás" accent="gas">
                  <Field label="Número">
                    <input type="text" value={gasNumero} onChange={(e) => setGasNumero(e.target.value)} className={inputClass} />
                  </Field>
                  <Field label="Data cons.">
                    <input type="text" value={dataConsGas} onChange={(e) => setDataConsGas(e.target.value)} className={inputClass} />
                  </Field>
                  <Field label="Existe débito">
                    <input type="text" value={existeDebGas} onChange={(e) => setExisteDebGas(e.target.value)} className={inputClass} />
                  </Field>
                  <Field label="Dia venc.">
                    <input type="text" value={diaVencGas} onChange={(e) => setDiaVencGas(e.target.value)} className={inputClass} />
                  </Field>
                </BlocoUtilidade>
                <BlocoUtilidade titulo="Contrato" accent="contrato">
                  <button type="button" onClick={() => setShowModalContrato(true)} className={`${btnPrimary} w-full`}>
                    Contrato
                  </button>
                  <Field label="Data início">
                    <input type="text" value={dataInicioContrato} onChange={(e) => setDataInicioContrato(e.target.value)} className={inputClass} />
                  </Field>
                  <Field label="Data fim">
                    <input type="text" value={dataFimContrato} onChange={(e) => setDataFimContrato(e.target.value)} className={inputClass} />
                  </Field>
                </BlocoUtilidade>
                <BlocoUtilidade titulo="Condomínio / repasse" accent="cond">
                  <Field label="Data cons. débito cond.">
                    <input type="text" value={dataConsDebitoCond} onChange={(e) => setDataConsDebitoCond(e.target.value)} className={inputClass} />
                  </Field>
                  <Field label="Existe débito cond.">
                    <input type="text" value={existeDebitoCond} onChange={(e) => setExisteDebitoCond(e.target.value)} className={inputClass} />
                  </Field>
                  <Field label="Dia repasse">
                    <input type="text" value={diaRepasse} onChange={(e) => setDiaRepasse(e.target.value)} className={inputClass} />
                  </Field>
                </BlocoUtilidade>
              </div>
            </section>

            <fieldset className="imoveis-admin-section rounded-2xl border border-slate-200/90 dark:border-white/[0.08] bg-slate-50/60 dark:bg-white/[0.02] p-5 sm:p-6 shadow-sm">
              <legend className="text-sm font-semibold text-slate-800 dark:text-slate-100 px-2">Dados bancários</legend>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 mt-1 leading-relaxed">
                Conta para repasse (banco, agência, conta, titular, PIX).
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                <Field label="Banco">
                  <input type="text" value={banco} onChange={(e) => setBanco(e.target.value)} className={inputClass} />
                </Field>
                <Field label="Nº Banco">
                  <input type="text" value={numeroBanco} onChange={(e) => setNumeroBanco(e.target.value)} className={inputClass} />
                </Field>
                <Field label="Agência">
                  <input type="text" value={agencia} onChange={(e) => setAgencia(e.target.value)} className={inputClass} />
                </Field>
                <Field label="Conta">
                  <input type="text" value={conta} onChange={(e) => setConta(e.target.value)} className={inputClass} />
                </Field>
                <Field label="CPF">
                  <input type="text" value={cpfBanco} onChange={(e) => setCpfBanco(e.target.value)} className={inputClass} />
                </Field>
                <Field label="Chave Pix" className="lg:col-span-2">
                  <input type="text" value={chavePix} onChange={(e) => setChavePix(e.target.value)} className={inputClass} />
                </Field>
                <Field label="Titular" className="sm:col-span-2 lg:col-span-4">
                  <input type="text" value={titular} onChange={(e) => setTitular(e.target.value)} className={inputClass} />
                </Field>
              </div>
            </fieldset>

            <section className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-start">
                <fieldset className="rounded-2xl border border-slate-200/90 dark:border-white/[0.08] p-5 sm:p-6 space-y-4 bg-white/80 dark:bg-[#151d2c]/90 shadow-sm">
                  <legend className="text-sm font-semibold text-slate-800 dark:text-slate-100 px-2">Proprietário</legend>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        navigate('/clientes/lista', {
                          state: {
                            origemImoveis: true,
                            papelPropriedade: 'proprietario',
                            imovelId,
                            codigoImovel: String(codigo ?? ''),
                          },
                        })
                      }
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-cyan-700 dark:text-cyan-400 hover:text-cyan-900 dark:hover:text-cyan-300 underline underline-offset-4 decoration-cyan-500/50 hover:decoration-cyan-600 transition-colors"
                    >
                      <UserPlus className="w-4 h-4 shrink-0" aria-hidden />
                      Vincular pessoa
                    </button>
                  </div>
                  <Field label="Número da pessoa">
                    <input
                      type="text"
                      value={proprietarioNumeroPessoa}
                      onChange={(e) => setProprietarioNumeroPessoa(e.target.value)}
                      className={inputClass}
                      autoComplete="off"
                    />
                  </Field>
                  <Field label="Nome">
                    <input type="text" value={proprietario} onChange={(e) => setProprietario(e.target.value)} className={inputClass} />
                  </Field>
                  <Field label="CPF">
                    <input type="text" value={proprietarioCpf} onChange={(e) => setProprietarioCpf(e.target.value)} className={inputClass} />
                  </Field>
                  <Field label="Contato">
                    <input type="text" value={proprietarioContato} onChange={(e) => setProprietarioContato(e.target.value)} className={inputClass} />
                  </Field>
                </fieldset>

                <fieldset className="rounded-2xl border border-slate-200/90 dark:border-white/[0.08] p-5 sm:p-6 space-y-4 bg-white/80 dark:bg-[#151d2c]/90 min-w-0 shadow-sm">
                  <legend className="text-sm font-semibold text-slate-800 dark:text-slate-100 px-2">Inquilino</legend>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        navigate('/clientes/lista', {
                          state: {
                            origemImoveis: true,
                            papelPropriedade: 'inquilino',
                            imovelId,
                            codigoImovel: String(codigo ?? ''),
                          },
                        })
                      }
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-cyan-700 dark:text-cyan-400 hover:text-cyan-900 dark:hover:text-cyan-300 underline underline-offset-4 decoration-cyan-500/50 hover:decoration-cyan-600 transition-colors"
                    >
                      <UserPlus className="w-4 h-4 shrink-0" aria-hidden />
                      Vincular pessoa
                    </button>
                  </div>
                  <Field label="Número da pessoa">
                    <input
                      type="text"
                      value={inquilinoNumeroPessoa}
                      onChange={(e) => setInquilinoNumeroPessoa(e.target.value)}
                      className={inputClass}
                      autoComplete="off"
                    />
                  </Field>
                  <Field label="Nome">
                    <input type="text" value={inquilino} onChange={(e) => setInquilino(e.target.value)} className={inputClass} />
                  </Field>
                  <Field label="CPF">
                    <input type="text" value={inquilinoCpf} onChange={(e) => setInquilinoCpf(e.target.value)} className={inputClass} />
                  </Field>
                  <Field label="Contato">
                    <input type="text" value={inquilinoContato} onChange={(e) => setInquilinoContato(e.target.value)} className={inputClass} />
                  </Field>
                </fieldset>
              </div>
              <Field label="Link Vistoria" className="max-w-full pt-2">
                <input type="text" value={linkVistoria} onChange={(e) => setLinkVistoria(e.target.value)} className={inputClass} />
              </Field>
            </section>

            <footer className="flex justify-center pt-6 border-t border-slate-200/90 dark:border-white/[0.08]">
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={salvarCadastroAtual} disabled={apiSaving} className={`${btnPrimary} px-10 py-3 font-semibold`}>
                  {apiSaving ? 'Salvando...' : 'Salvar'}
                </button>
                <button type="button" onClick={() => window.history.back()} className={`${btnSecondary} px-12 py-3 font-semibold`}>
                  Fechar
                </button>
              </div>
            </footer>
          </div>
        </div>
      </div>

      {/* Modal Informações sobre o Contrato */}
      {showModalContrato && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowModalContrato(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-contrato-titulo"
        >
          <div
            className="bg-slate-100 dark:bg-[#161e2e] rounded-2xl shadow-2xl border border-slate-300/90 dark:border-white/[0.1] max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1a2436] rounded-t-2xl">
              <h2 id="modal-contrato-titulo" className="text-base font-semibold text-slate-800 dark:text-slate-100">
                Informações sobre o Contrato
              </h2>
              <button type="button" onClick={() => setShowModalContrato(false)} className={btnIconGhost} aria-label="Fechar">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-slate-700 mb-1.5">Contrato Assinado Pelo Inquilino</p>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <input type="radio" name="contratoInquilino" checked={contratoAssinadoInquilino === 'sim'} onChange={() => setContratoAssinadoInquilino('sim')} className="text-slate-600" />
                        Sim
                      </label>
                      <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <input type="radio" name="contratoInquilino" checked={contratoAssinadoInquilino === 'nao'} onChange={() => setContratoAssinadoInquilino('nao')} className="text-slate-600" />
                        Não
                      </label>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700 mb-1.5">Contrato Assinado Pelo Proprietário</p>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <input type="radio" name="contratoProprietario" checked={contratoAssinadoProprietario === 'sim'} onChange={() => setContratoAssinadoProprietario('sim')} className="text-slate-600" />
                        Sim
                      </label>
                      <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <input type="radio" name="contratoProprietario" checked={contratoAssinadoProprietario === 'nao'} onChange={() => setContratoAssinadoProprietario('nao')} className="text-slate-600" />
                        Não
                      </label>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700 mb-1.5">Contrato Assinado Pelo Garantidor</p>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <input type="radio" name="contratoGarantidor" checked={contratoAssinadoGarantidor === 'sim'} onChange={() => setContratoAssinadoGarantidor('sim')} className="text-slate-600" />
                        Sim
                      </label>
                      <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <input type="radio" name="contratoGarantidor" checked={contratoAssinadoGarantidor === 'nao'} onChange={() => setContratoAssinadoGarantidor('nao')} className="text-slate-600" />
                        Não
                      </label>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700 mb-1.5">Contrato Assinado Pelas Testemunhas</p>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <input type="radio" name="contratoTestemunhas" checked={contratoAssinadoTestemunhas === 'sim'} onChange={() => setContratoAssinadoTestemunhas('sim')} className="text-slate-600" />
                        Sim
                      </label>
                      <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <input type="radio" name="contratoTestemunhas" checked={contratoAssinadoTestemunhas === 'nao'} onChange={() => setContratoAssinadoTestemunhas('nao')} className="text-slate-600" />
                        Não
                      </label>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700 mb-1.5">Contrato Arquivado</p>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <input type="radio" name="contratoArquivado" checked={contratoArquivado === 'sim'} onChange={() => setContratoArquivado('sim')} className="text-slate-600" />
                        Sim
                      </label>
                      <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <input type="radio" name="contratoArquivado" checked={contratoArquivado === 'nao'} onChange={() => setContratoArquivado('nao')} className="text-slate-600" />
                        Não
                      </label>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-slate-700 mb-1.5">Contrato de Intermediação Imobiliária Arquivado</p>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <input type="radio" name="intermediacaoArquivado" checked={contratoIntermediacaoArquivado === 'sim'} onChange={() => setContratoIntermediacaoArquivado('sim')} className="text-slate-600" />
                        Sim
                      </label>
                      <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <input type="radio" name="intermediacaoArquivado" checked={contratoIntermediacaoArquivado === 'nao'} onChange={() => setContratoIntermediacaoArquivado('nao')} className="text-slate-600" />
                        Não
                      </label>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700 mb-1.5">Contrato de Intermediação Imobiliária Assinado Pelo Proprietário</p>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <input type="radio" name="intermediacaoProprietario" checked={contratoIntermediacaoAssinadoProprietario === 'sim'} onChange={() => setContratoIntermediacaoAssinadoProprietario('sim')} className="text-slate-600" />
                        Sim
                      </label>
                      <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <input type="radio" name="intermediacaoProprietario" checked={contratoIntermediacaoAssinadoProprietario === 'nao'} onChange={() => setContratoIntermediacaoAssinadoProprietario('nao')} className="text-slate-600" />
                        Não
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#151d2c] rounded-b-2xl flex justify-center">
              <button type="button" onClick={() => setShowModalContrato(false)} className={btnSecondary}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Informações sobre o IPTU */}
      {showModalIptu && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowModalIptu(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-iptu-titulo"
        >
          <div
            className="bg-slate-100 dark:bg-[#161e2e] rounded-2xl shadow-2xl border border-slate-300/90 dark:border-white/[0.1] max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1a2436] rounded-t-2xl">
              <h2 id="modal-iptu-titulo" className="text-base font-semibold text-slate-800 dark:text-slate-100">
                Informações sobre o IPTU
              </h2>
              <button
                type="button"
                onClick={() => setShowModalIptu(false)}
                className={btnIconGhost}
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              <Field label="Informações Sobre IPTU">
                <textarea
                  value={infoIptuTexto}
                  onChange={(e) => setInfoIptuTexto(e.target.value)}
                  rows={5}
                  className={`${inputClass} resize-y bg-white`}
                  placeholder="Informações sobre o IPTU..."
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Existe débito IPTU">
                  <input type="text" value={existeDebIptu} onChange={(e) => setExisteDebIptu(e.target.value)} className={inputClass} />
                </Field>
                <Field label="Data Consulta débito IPTU">
                  <input
                    type="text"
                    value={dataConsIptu}
                    onChange={(e) => {
                      const v = e.target.value;
                      setDataConsIptu(resolverAliasHojeEmTexto(v, 'br') ?? v);
                    }}
                    className={inputClass}
                    placeholder="dd/mm/aaaa ou hj"
                  />
                </Field>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#151d2c] rounded-b-2xl flex justify-center">
              <button type="button" onClick={() => setShowModalIptu(false)} className={btnSecondary}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
