import { useState } from 'react';
import { X, ChevronUp, ChevronDown } from 'lucide-react';

function Field({ label, children, className = '' }) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-slate-700 mb-0.5">{label}</label>
      {children}
    </div>
  );
}

const inputClass = 'w-full px-2 py-1.5 border border-slate-300 rounded text-sm bg-white';

export function Imoveis() {
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

  return (
    <div className="min-h-full bg-slate-200">
      <div className="max-w-[1400px] mx-auto px-3 py-3">
        <header className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-slate-800">Imóveis em Administração</h1>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="p-2 rounded border border-slate-400 bg-white text-slate-600 hover:bg-slate-100"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="bg-white rounded border border-slate-300 shadow-sm overflow-hidden">
          <div className="p-4 space-y-4">
            {/* Identificação e status */}
            <section className="flex flex-wrap items-end gap-4">
              <Field label="Imóvel" className="w-24">
                <div className="flex border border-slate-300 rounded overflow-hidden">
                  <button type="button" className="p-1 border-r border-slate-300 hover:bg-slate-100" onClick={() => setImovelId((i) => Math.max(1, i - 1))}>
                    <ChevronUp className="w-3 h-3" />
                  </button>
                  <input type="number" value={imovelId} onChange={(e) => setImovelId(Number(e.target.value) || 0)} className="w-14 px-1 py-1.5 text-sm text-center border-0" />
                  <button type="button" className="p-1 border-l border-slate-300 hover:bg-slate-100" onClick={() => setImovelId((i) => i + 1)}>
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </div>
              </Field>
              <div className="border border-slate-300 rounded p-2 bg-slate-50/50">
                <p className="text-sm font-medium text-slate-700 mb-1.5">Imóvel Ocupado</p>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="radio" name="ocupado" checked={imovelOcupado} onChange={() => setImovelOcupado(true)} className="text-slate-600" />
                    Sim
                  </label>
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="radio" name="ocupado" checked={!imovelOcupado} onChange={() => setImovelOcupado(false)} className="text-slate-600" />
                    Não
                  </label>
                </div>
              </div>
              <button type="button" className="px-4 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50">Abrir Proc.</button>
              <Field label="Código:" className="w-24">
                <input type="text" value={codigo} onChange={(e) => setCodigo(e.target.value)} className={inputClass} />
              </Field>
              <Field label="Proc.:" className="w-24">
                <input type="text" value={proc} onChange={(e) => setProc(e.target.value)} className={inputClass} />
              </Field>
              <Field label="Observações sobre Inquilino" className="flex-1 min-w-[200px]">
                <textarea value={observacoesInquilino} onChange={(e) => setObservacoesInquilino(e.target.value)} rows={2} className={`${inputClass} resize-y`} />
              </Field>
            </section>

            {/* Endereço */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-200 pt-4">
              <Field label="Endereço:" className="md:col-span-2">
                <textarea value={endereco} onChange={(e) => setEndereco(e.target.value)} rows={2} className={`${inputClass} resize-y`} />
              </Field>
              <Field label="Condomínio:">
                <input type="text" value={condominio} onChange={(e) => setCondominio(e.target.value)} className={inputClass} />
              </Field>
              <Field label="Unidade:">
                <input type="text" value={unidade} onChange={(e) => setUnidade(e.target.value)} className={inputClass} />
              </Field>
              <Field label="Garagens:" className="w-24">
                <input type="text" value={garagens} onChange={(e) => setGaragens(e.target.value)} className={inputClass} />
              </Field>
            </section>

            {/* Garantia e locação */}
            <section className="grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-slate-200 pt-4">
              <Field label="Garantia:">
                <input type="text" value={garantia} onChange={(e) => setGarantia(e.target.value)} className={inputClass} />
              </Field>
              <Field label="Valor da Garantia:">
                <input type="text" value={valorGarantia} onChange={(e) => setValorGarantia(e.target.value)} className={inputClass} />
              </Field>
              <Field label="Valor da Locação:">
                <input type="text" value={valorLocacao} onChange={(e) => setValorLocacao(e.target.value)} className={inputClass} />
              </Field>
              <Field label="Dia Pag. Aluguel:">
                <input type="text" value={diaPagAluguel} onChange={(e) => setDiaPagAluguel(e.target.value)} className={inputClass} />
              </Field>
              <div className="col-span-2 md:col-span-4 flex flex-wrap gap-2">
                <button type="button" className="px-4 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50">Catálogo</button>
                <button type="button" className="px-4 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50">Doc. Interessados</button>
                <Field label="Data pag. 1ª Tx. Cond.:" className="w-40">
                  <input type="text" value={dataPag1TxCond} onChange={(e) => setDataPag1TxCond(e.target.value)} placeholder="dd/mm/aaaa" className={inputClass} />
                </Field>
              </div>
              <Field label="Inscrição Imobiliária:">
                <input type="text" value={inscricaoImobiliaria} onChange={(e) => setInscricaoImobiliaria(e.target.value)} className={inputClass} />
              </Field>
              <Field label="Existe Deb. IPTU:">
                <input type="text" value={existeDebIptu} onChange={(e) => setExisteDebIptu(e.target.value)} className={inputClass} />
              </Field>
              <Field label="Data Cons.:">
                <input type="text" value={dataConsIptu} onChange={(e) => setDataConsIptu(e.target.value)} className={inputClass} />
              </Field>
              <div className="flex items-end">
                <button type="button" onClick={() => setShowModalIptu(true)} className="px-4 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50">IPTU</button>
              </div>
            </section>

            {/* Água, Energia, Gás e Contrato */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-200 pt-4">
              <div className="border border-slate-200 rounded p-3 bg-slate-50/30 space-y-2">
                <p className="text-sm font-medium text-slate-700">Água</p>
                <input type="text" value={aguaNumero} onChange={(e) => setAguaNumero(e.target.value)} className={inputClass} />
                <Field label="Data cons. Água:">
                  <input type="text" value={dataConsAgua} onChange={(e) => setDataConsAgua(e.target.value)} className={inputClass} />
                </Field>
                <Field label="Existe Déb. Água:">
                  <input type="text" value={existeDebAgua} onChange={(e) => setExisteDebAgua(e.target.value)} className={inputClass} />
                </Field>
                <Field label="Dia Venc. Água:">
                  <input type="text" value={diaVencAgua} onChange={(e) => setDiaVencAgua(e.target.value)} className={inputClass} />
                </Field>
              </div>
              <div className="border border-slate-200 rounded p-3 bg-slate-50/30 space-y-2">
                <p className="text-sm font-medium text-slate-700">Energia</p>
                <input type="text" value={energiaNumero} onChange={(e) => setEnergiaNumero(e.target.value)} className={inputClass} />
                <Field label="Data cons. Energia:">
                  <input type="text" value={dataConsEnergia} onChange={(e) => setDataConsEnergia(e.target.value)} className={inputClass} />
                </Field>
                <Field label="Existe Déb. Energia:">
                  <input type="text" value={existeDebEnergia} onChange={(e) => setExisteDebEnergia(e.target.value)} className={inputClass} />
                </Field>
                <Field label="Dia Venc. Energia:">
                  <input type="text" value={diaVencEnergia} onChange={(e) => setDiaVencEnergia(e.target.value)} className={inputClass} />
                </Field>
              </div>
              <div className="border border-slate-200 rounded p-3 bg-slate-50/30 space-y-2">
                <p className="text-sm font-medium text-slate-700">Gás</p>
                <input type="text" value={gasNumero} onChange={(e) => setGasNumero(e.target.value)} className={inputClass} />
                <Field label="Data cons. Gás:">
                  <input type="text" value={dataConsGas} onChange={(e) => setDataConsGas(e.target.value)} className={inputClass} />
                </Field>
                <Field label="Existe Déb. Gás:">
                  <input type="text" value={existeDebGas} onChange={(e) => setExisteDebGas(e.target.value)} className={inputClass} />
                </Field>
                <Field label="Dia Venc. Gás:">
                  <input type="text" value={diaVencGas} onChange={(e) => setDiaVencGas(e.target.value)} className={inputClass} />
                </Field>
              </div>
            </section>

            <section className="grid grid-cols-2 md:grid-cols-5 gap-4 border-t border-slate-200 pt-4">
              <div className="col-span-2 md:col-span-2 border border-slate-200 rounded p-3 bg-slate-50/30 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-700">CONTRATO</p>
                  <button type="button" onClick={() => setShowModalContrato(true)} className="px-3 py-1.5 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50">Contrato</button>
                </div>
                <Field label="Data Início Contrato:">
                  <input type="text" value={dataInicioContrato} onChange={(e) => setDataInicioContrato(e.target.value)} className={inputClass} />
                </Field>
                <Field label="Data Fim Contrato:">
                  <input type="text" value={dataFimContrato} onChange={(e) => setDataFimContrato(e.target.value)} className={inputClass} />
                </Field>
              </div>
              <Field label="Data Cons. Débito Cond.:">
                <input type="text" value={dataConsDebitoCond} onChange={(e) => setDataConsDebitoCond(e.target.value)} className={inputClass} />
              </Field>
              <Field label="Existe Débito Cond.:">
                <input type="text" value={existeDebitoCond} onChange={(e) => setExisteDebitoCond(e.target.value)} className={inputClass} />
              </Field>
              <Field label="Dia Repasse:">
                <input type="text" value={diaRepasse} onChange={(e) => setDiaRepasse(e.target.value)} className={inputClass} />
              </Field>
            </section>

            {/* Dados Bancários */}
            <section className="border-t border-slate-200 pt-4">
              <h3 className="text-sm font-semibold text-slate-800 mb-3">Dados Bancários</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="Banco:">
                  <input type="text" value={banco} onChange={(e) => setBanco(e.target.value)} className={inputClass} />
                </Field>
                <Field label="Agência:">
                  <input type="text" value={agencia} onChange={(e) => setAgencia(e.target.value)} className={inputClass} />
                </Field>
                <Field label="Nº Banco:">
                  <input type="text" value={numeroBanco} onChange={(e) => setNumeroBanco(e.target.value)} className={inputClass} />
                </Field>
                <Field label="Conta:">
                  <input type="text" value={conta} onChange={(e) => setConta(e.target.value)} className={inputClass} />
                </Field>
                <Field label="CPF:">
                  <input type="text" value={cpfBanco} onChange={(e) => setCpfBanco(e.target.value)} className={inputClass} />
                </Field>
                <Field label="Titular:">
                  <input type="text" value={titular} onChange={(e) => setTitular(e.target.value)} className={inputClass} />
                </Field>
                <Field label="Chave Pix:" className="md:col-span-2">
                  <input type="text" value={chavePix} onChange={(e) => setChavePix(e.target.value)} className={inputClass} />
                </Field>
              </div>
            </section>

            {/* Proprietário e Inquilino */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-200 pt-4">
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input type="text" value={proprietarioCod1} onChange={(e) => setProprietarioCod1(e.target.value)} className={`w-20 ${inputClass}`} />
                  <input type="text" value={proprietarioCod2} onChange={(e) => setProprietarioCod2(e.target.value)} className={`w-20 ${inputClass}`} />
                </div>
                <h3 className="text-sm font-semibold text-slate-800">Proprietário</h3>
                <Field label="Proprietário:">
                  <input type="text" value={proprietario} onChange={(e) => setProprietario(e.target.value)} className={inputClass} />
                </Field>
                <Field label="CPF:">
                  <input type="text" value={proprietarioCpf} onChange={(e) => setProprietarioCpf(e.target.value)} className={inputClass} />
                </Field>
                <Field label="Contato:">
                  <input type="text" value={proprietarioContato} onChange={(e) => setProprietarioContato(e.target.value)} className={inputClass} />
                </Field>
              </div>
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-800">Inquilino</h3>
                <Field label="Link Vistoria:">
                  <input type="text" value={linkVistoria} onChange={(e) => setLinkVistoria(e.target.value)} className={inputClass} />
                </Field>
                <Field label="Inquilino:">
                  <input type="text" value={inquilino} onChange={(e) => setInquilino(e.target.value)} className={inputClass} />
                </Field>
                <Field label="CPF:">
                  <input type="text" value={inquilinoCpf} onChange={(e) => setInquilinoCpf(e.target.value)} className={inputClass} />
                </Field>
                <Field label="Contato:">
                  <input type="text" value={inquilinoContato} onChange={(e) => setInquilinoContato(e.target.value)} className={inputClass} />
                </Field>
              </div>
            </section>

            <footer className="flex justify-center pt-4 border-t border-slate-200">
              <button type="button" className="px-6 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50">
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
                  <input type="text" value={dataConsIptu} onChange={(e) => setDataConsIptu(e.target.value)} className={inputClass} placeholder="dd/mm/aaaa" />
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
