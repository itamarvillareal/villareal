import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { X, ChevronUp, ChevronDown } from 'lucide-react';
import { getImovelMock } from '../data/imoveisMockData';
import { resolverAliasHojeEmTexto } from '../services/hjDateAliasService.js';

function Field({ label, children, className = '' }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-slate-600 mb-0.5">{label}</label>
      {children}
    </div>
  );
}

/** Coluna tipo legado (Água / Energia / …): título em caixa alta e campos empilhados. */
function BlocoUtilidade({ titulo, children }) {
  return (
    <div className="rounded-lg border border-slate-300 bg-slate-50/90 p-3 shadow-sm flex flex-col gap-2 min-h-0">
      <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wide border-b border-slate-200 pb-1.5 shrink-0">
        {titulo}
      </p>
      <div className="space-y-2 flex-1 min-w-0">{children}</div>
    </div>
  );
}

const inputClass = 'w-full px-2 py-1.5 border border-slate-300 rounded text-sm bg-white';
const sectionHeading = 'text-sm font-semibold text-slate-800 border-b border-slate-200 pb-2 mb-3';

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
  const [proprietarioCod1, setProprietarioCod1] = useState('868');
  const [proprietarioCod2, setProprietarioCod2] = useState('6921');
  const [proprietario, setProprietario] = useState('ITAMAR ALEXANDRE FELIX VILLA REAL JUNIOR');
  const [proprietarioCpf, setProprietarioCpf] = useState('007.332.351-90');
  const [proprietarioContato, setProprietarioContato] = useState('62-8234-5000 // 62 3018-6998');
  const [linkVistoria, setLinkVistoria] = useState('https://www.drop');
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

  const unidadeAlvo = location.state && typeof location.state === 'object' ? location.state.unidade : null;

  useEffect(() => {
    const mock = getImovelMock(imovelId);
    if (!mock) {
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
      setProprietarioCod1('');
      setProprietarioCod2('');
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
      return;
    }

    setImovelOcupado(!!mock.imovelOcupado);
    setCodigo(String(mock.codigo ?? ''));
    setProc(Number(mock.proc ?? 1));
    setObservacoesInquilino(String(mock.observacoesInquilino ?? ''));
    setEndereco(String(mock.endereco ?? ''));
    setCondominio(String(mock.condominio ?? ''));
    setUnidade(String(mock.unidade ?? ''));
    if (unidadeAlvo != null) setUnidade(String(unidadeAlvo));
    setGaragens(String(mock.garagens ?? ''));
    setGarantia(String(mock.garantia ?? ''));
    setValorGarantia(String(mock.valorGarantia ?? ''));
    setValorLocacao(String(mock.valorLocacao ?? ''));
    setDiaPagAluguel(String(mock.diaPagAluguel ?? ''));
    setDataPag1TxCond(String(mock.dataPag1TxCond ?? ''));
    setInscricaoImobiliaria(String(mock.inscricaoImobiliaria ?? ''));
    setExisteDebIptu(String(mock.existeDebIptu ?? ''));
    setDataConsIptu(String(mock.dataConsIptu ?? ''));

    setAguaNumero(String(mock.aguaNumero ?? ''));
    setDataConsAgua(String(mock.dataConsAgua ?? ''));
    setExisteDebAgua(String(mock.existeDebAgua ?? ''));
    setDiaVencAgua(String(mock.diaVencAgua ?? ''));

    setEnergiaNumero(String(mock.energiaNumero ?? ''));
    setDataConsEnergia(String(mock.dataConsEnergia ?? ''));
    setExisteDebEnergia(String(mock.existeDebEnergia ?? ''));
    setDiaVencEnergia(String(mock.diaVencEnergia ?? ''));

    setGasNumero(String(mock.gasNumero ?? ''));
    setDataConsGas(String(mock.dataConsGas ?? ''));
    setExisteDebGas(String(mock.existeDebGas ?? ''));
    setDiaVencGas(String(mock.diaVencGas ?? ''));

    setDataInicioContrato(String(mock.dataInicioContrato ?? ''));
    setDataFimContrato(String(mock.dataFimContrato ?? ''));
    setDataConsDebitoCond(String(mock.dataConsDebitoCond ?? ''));
    setExisteDebitoCond(String(mock.existeDebitoCond ?? ''));
    setDiaRepasse(String(mock.diaRepasse ?? ''));

    setBanco(String(mock.banco ?? ''));
    setAgencia(String(mock.agencia ?? ''));
    setNumeroBanco(String(mock.numeroBanco ?? ''));
    setConta(String(mock.conta ?? ''));
    setCpfBanco(String(mock.cpfBanco ?? ''));
    setTitular(String(mock.titular ?? ''));
    setChavePix(String(mock.chavePix ?? ''));

    setProprietarioCod1(String(mock.proprietarioCod1 ?? ''));
    setProprietarioCod2(String(mock.proprietarioCod2 ?? ''));
    setProprietario(String(mock.proprietario ?? ''));
    setProprietarioCpf(String(mock.proprietarioCpf ?? ''));
    setProprietarioContato(String(mock.proprietarioContato ?? ''));
    setLinkVistoria(String(mock.linkVistoria ?? ''));

    setInquilino(String(mock.inquilino ?? ''));
    setInquilinoCpf(String(mock.inquilinoCpf ?? ''));
    setInquilinoContato(String(mock.inquilinoContato ?? ''));
  }, [imovelId, unidadeAlvo]);

  useEffect(() => {
    const state = location.state && typeof location.state === 'object' ? location.state : null;
    const nextImovelId = state?.imovelId != null ? Number(state.imovelId) : null;
    if (!Number.isFinite(nextImovelId) || nextImovelId <= 0) return;
    setImovelId(nextImovelId);
  }, [location.key, location.state]);

  function abrirProcessoDoImovel() {
    navigate('/processos', {
      state: {
        codCliente: String(codigo ?? ''),
        proc: String(proc ?? ''),
      },
    });
  }

  return (
    <div className="min-h-full bg-slate-200">
      <div className="max-w-[1600px] mx-auto px-3 py-3 pb-8">
        <header className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Imóveis em Administração</h1>
            <p className="text-xs text-slate-500 mt-0.5">Cadastro do imóvel, locação, utilidades, conta para repasse e partes.</p>
          </div>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="p-2 rounded-lg border border-slate-400 bg-white text-slate-600 hover:bg-slate-100 shrink-0"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="bg-white rounded-lg border border-slate-300 shadow-sm overflow-hidden">
          {/* Faixa superior: identificação (como formulário legado) */}
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-100/90">
            <div className="flex flex-wrap items-end gap-x-5 gap-y-3">
              <Field label="Imóvel" className="w-[5.5rem] shrink-0">
                <div className="flex border border-slate-300 rounded-md overflow-hidden bg-white shadow-sm">
                  <button
                    type="button"
                    className="px-1.5 py-2 border-r border-slate-300 hover:bg-slate-50"
                    onClick={() => setImovelId((i) => Math.max(1, i - 1))}
                    aria-label="Imóvel anterior"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="number"
                    value={imovelId}
                    onChange={(e) => setImovelId(Number(e.target.value) || 0)}
                    className="w-12 px-1 py-2 text-sm text-center border-0 tabular-nums"
                  />
                  <button
                    type="button"
                    className="px-1.5 py-2 border-l border-slate-300 hover:bg-slate-50"
                    onClick={() => setImovelId((i) => i + 1)}
                    aria-label="Próximo imóvel"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </Field>

              <fieldset className="border border-slate-300 rounded-md px-3 py-2 bg-white shrink-0">
                <legend className="text-xs font-semibold text-slate-700 px-1">Imóvel Ocupado</legend>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="radio" name="ocupado" checked={imovelOcupado} onChange={() => setImovelOcupado(true)} className="text-teal-700" />
                    Sim
                  </label>
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="radio" name="ocupado" checked={!imovelOcupado} onChange={() => setImovelOcupado(false)} className="text-teal-700" />
                    Não
                  </label>
                </div>
              </fieldset>

              <button
                type="button"
                onClick={abrirProcessoDoImovel}
                className="px-4 py-2 rounded-md border border-slate-400 bg-white text-slate-800 text-sm font-medium hover:bg-slate-50 shadow-sm"
              >
                Abrir Proc.
              </button>

              <Field label="Código" className="w-[5.5rem] shrink-0">
                <input type="text" value={codigo} onChange={(e) => setCodigo(e.target.value)} className={inputClass} />
              </Field>
              <Field label="Proc." className="w-[5.5rem] shrink-0">
                <input type="text" value={proc} onChange={(e) => setProc(e.target.value)} className={inputClass} />
              </Field>
            </div>
          </div>

          <div className="p-4 md:p-5 space-y-6">
            {/* Endereço (2/3) + Observações inquilino (1/3) */}
            <section className="grid grid-cols-1 xl:grid-cols-12 gap-5">
              <div className="xl:col-span-8 space-y-4">
                <h2 className={sectionHeading}>Endereço e unidade</h2>
                <Field label="Endereço">
                  <textarea value={endereco} onChange={(e) => setEndereco(e.target.value)} rows={3} className={`${inputClass} resize-y`} />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4">
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
              <fieldset className="xl:col-span-4 rounded-lg border border-slate-300 bg-slate-50/80 p-4 flex flex-col min-h-[11rem]">
                <legend className="text-sm font-semibold text-slate-800 px-1">Observações sobre Inquilino</legend>
                <textarea
                  value={observacoesInquilino}
                  onChange={(e) => setObservacoesInquilino(e.target.value)}
                  rows={6}
                  className={`${inputClass} resize-y flex-1 min-h-[8rem] bg-white mt-1`}
                />
              </fieldset>
            </section>

            {/* Garantia, locação, 1ª taxa cond., IPTU */}
            <section className="rounded-lg border border-slate-300 bg-slate-50/50 p-4 space-y-4">
              <h2 className={sectionHeading}>Garantia, locação e IPTU</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                <button
                  type="button"
                  className="px-4 py-2 rounded-md border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-100"
                >
                  Catálogo
                </button>
                <button
                  type="button"
                  className="px-4 py-2 rounded-md border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-100"
                >
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end pt-3 border-t border-slate-200">
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
                  <button
                    type="button"
                    onClick={() => setShowModalIptu(true)}
                    className="w-full sm:w-auto px-5 py-2 rounded-md border border-slate-400 bg-white text-slate-800 text-sm font-medium hover:bg-slate-100"
                  >
                    IPTU
                  </button>
                </div>
              </div>
            </section>

            {/* Cinco colunas: água, energia, gás, contrato, condomínio/repasse */}
            <section>
              <h2 className={sectionHeading}>Água, energia, gás, contrato e condomínio</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
                <BlocoUtilidade titulo="Água">
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
                <BlocoUtilidade titulo="Energia">
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
                <BlocoUtilidade titulo="Gás">
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
                <BlocoUtilidade titulo="Contrato">
                  <button
                    type="button"
                    onClick={() => setShowModalContrato(true)}
                    className="w-full px-3 py-2 rounded-md border border-slate-400 bg-white text-slate-800 text-sm font-medium hover:bg-slate-100"
                  >
                    Contrato
                  </button>
                  <Field label="Data início">
                    <input type="text" value={dataInicioContrato} onChange={(e) => setDataInicioContrato(e.target.value)} className={inputClass} />
                  </Field>
                  <Field label="Data fim">
                    <input type="text" value={dataFimContrato} onChange={(e) => setDataFimContrato(e.target.value)} className={inputClass} />
                  </Field>
                </BlocoUtilidade>
                <BlocoUtilidade titulo="Condomínio / repasse">
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

            <fieldset className="rounded-lg border border-slate-300 bg-slate-50/40 p-4">
              <legend className="text-sm font-semibold text-slate-800 px-2">Dados bancários</legend>
              <p className="text-[11px] text-slate-500 mb-3 -mt-1">Conta para repasse (banco, agência, conta, titular, PIX).</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <fieldset className="rounded-lg border border-slate-300 p-4 space-y-3 bg-white">
                <legend className="text-sm font-semibold text-slate-800 px-2">Proprietário</legend>
                <div className="flex flex-wrap gap-2">
                  <Field label="Cód." className="w-[4.5rem]">
                    <input type="text" value={proprietarioCod1} onChange={(e) => setProprietarioCod1(e.target.value)} className={inputClass} />
                  </Field>
                  <Field label="Cód." className="w-[4.5rem]">
                    <input type="text" value={proprietarioCod2} onChange={(e) => setProprietarioCod2(e.target.value)} className={inputClass} />
                  </Field>
                </div>
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

              <fieldset className="rounded-lg border border-slate-300 p-4 space-y-3 bg-white">
                <legend className="text-sm font-semibold text-slate-800 px-2">Inquilino</legend>
                <Field label="Link Vistoria">
                  <input type="text" value={linkVistoria} onChange={(e) => setLinkVistoria(e.target.value)} className={inputClass} />
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
            </section>

            <footer className="flex justify-center pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => window.history.back()}
                className="px-10 py-2.5 rounded-md border border-slate-400 bg-slate-100 text-slate-800 text-sm font-medium hover:bg-slate-200"
              >
                Fechar
              </button>
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
            className="bg-slate-100 rounded-lg shadow-xl border border-slate-300 max-w-2xl w-full max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-300 bg-white rounded-t-lg">
              <h2 id="modal-contrato-titulo" className="text-sm font-semibold text-slate-800">
                Informações sobre o Contrato
              </h2>
              <button type="button" onClick={() => setShowModalContrato(false)} className="p-2 rounded text-slate-500 hover:bg-slate-100" aria-label="Fechar">
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
            <div className="px-4 py-3 border-t border-slate-300 bg-white rounded-b-lg flex justify-center">
              <button type="button" onClick={() => setShowModalContrato(false)} className="px-6 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50">
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
            className="bg-slate-100 rounded-lg shadow-xl border border-slate-300 max-w-lg w-full max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-300 bg-white rounded-t-lg">
              <h2 id="modal-iptu-titulo" className="text-sm font-semibold text-slate-800">
                Informações sobre o IPTU
              </h2>
              <button
                type="button"
                onClick={() => setShowModalIptu(false)}
                className="p-2 rounded text-slate-500 hover:bg-slate-100"
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
            <div className="px-4 py-3 border-t border-slate-300 bg-white rounded-b-lg flex justify-center">
              <button
                type="button"
                onClick={() => setShowModalIptu(false)}
                className="px-6 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
