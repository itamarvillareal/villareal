import { useMemo } from 'react';
import {
  CircleDollarSign,
  FileText,
  Landmark,
  Layers,
  MapPin,
  Search,
  StickyNote,
  Users,
  Fingerprint,
} from 'lucide-react';
import {
  AccordionSection,
  CardParte,
  EnderecoComAcoes,
  ImoveisStickyHeader,
  ImoveisSummaryCards,
  ImoveisToast,
  IMOVEIS_SECTION_ACCENTS,
  TabelaUtilidades,
  unidadeResumoCabecalho,
  formatValorMoeda,
  imoveisBtnPrimary,
  imoveisBtnSecondary,
  imoveisInputClass,
} from './ImoveisAdminLayout.jsx';
import { CampoNumeroComContador } from '../ui/CampoNumeroComContador.jsx';
import { Field } from '../ui/Field.jsx';
import { featureFlags, FEATURE_IPTU_NOVO } from '../../config/featureFlags.js';
import { resolverAliasHojeEmTexto } from '../../services/hjDateAliasService.js';

/**
 * Conteúdo interno do cadastro de imóveis (dentro de `.imoveis-admin-sheet`).
 * Estado e efeitos permanecem no componente pai (`Imoveis.jsx`).
 *
 * @param {Record<string, unknown>} props
 */
export function ImoveisCadastroView(props) {
  const {
    apiLoading,
    apiError,
    apiSuccess,
    setApiSuccess,
    apiSaving,
    imovelId,
    setImovelId,
    imovelOcupado,
    setImovelOcupado,
    codigo,
    setCodigo,
    proc,
    setProc,
    _apiImovelId,
    _apiContratoId,
    _apiClienteId,
    _apiProcessoId,
    pesquisaCondUnidade,
    setPesquisaCondUnidade,
    resultadosPesquisaCondUnidade,
    onSelecionarImovelPesquisa,
    endereco,
    setEndereco,
    condominio,
    setCondominio,
    unidade,
    setUnidade,
    garagens,
    setGaragens,
    onCopiarEndereco,
    mapsUrl,
    garantia,
    setGarantia,
    valorGarantia,
    setValorGarantia,
    valorLocacao,
    setValorLocacao,
    diaPagAluguel,
    setDiaPagAluguel,
    dataPag1TxCond,
    setDataPag1TxCond,
    inscricaoImobiliaria,
    setInscricaoImobiliaria,
    existeDebIptu,
    setExisteDebIptu,
    dataConsIptu,
    setDataConsIptu,
    aguaNumero,
    setAguaNumero,
    dataConsAgua,
    setDataConsAgua,
    existeDebAgua,
    setExisteDebAgua,
    diaVencAgua,
    setDiaVencAgua,
    energiaNumero,
    setEnergiaNumero,
    dataConsEnergia,
    setDataConsEnergia,
    existeDebEnergia,
    setExisteDebEnergia,
    diaVencEnergia,
    setDiaVencEnergia,
    gasNumero,
    setGasNumero,
    dataConsGas,
    setDataConsGas,
    existeDebGas,
    setExisteDebGas,
    diaVencGas,
    setDiaVencGas,
    dataInicioContrato,
    setDataInicioContrato,
    dataFimContrato,
    setDataFimContrato,
    dataConsDebitoCond,
    setDataConsDebitoCond,
    existeDebitoCond,
    setExisteDebitoCond,
    diaRepasse,
    setDiaRepasse,
    banco,
    setBanco,
    agencia,
    setAgencia,
    numeroBanco,
    setNumeroBanco,
    conta,
    setConta,
    cpfBanco,
    setCpfBanco,
    titular,
    setTitular,
    chavePix,
    setChavePix,
    proprietarioNumeroPessoa,
    setProprietarioNumeroPessoa,
    proprietario,
    proprietarioCpf,
    proprietarioContato,
    proprietarioCadastroCarregando,
    proprietarioCadastroErro,
    inquilinoNumeroPessoa,
    setInquilinoNumeroPessoa,
    inquilino,
    inquilinoCpf,
    inquilinoContato,
    inquilinoCadastroCarregando,
    inquilinoCadastroErro,
    observacoesInquilino,
    setObservacoesInquilino,
    linkVistoria,
    setLinkVistoria,
    onSalvar,
    onAbrirProc,
    onContaCorrente,
    contaCorrenteDisabled,
    contaCorrenteTitle,
    onGerenciarIptu,
    onRelatorio,
    onFechar,
    onAbrirIptu,
    onVincularProprietario,
    onVincularInquilino,
  } = props;

  const unidadeResumo = unidadeResumoCabecalho(unidade, condominio);

  const summaryCards = useMemo(
    () => [
      {
        variant: 'aluguel',
        label: 'Aluguel',
        value:
          [formatValorMoeda(valorLocacao), diaPagAluguel?.trim() ? `dia ${diaPagAluguel}` : ''].filter(Boolean).join(' · ') ||
          '—',
        alert: !String(valorLocacao ?? '').trim(),
      },
      {
        variant: 'contrato',
        label: 'Contrato',
        value:
          [dataInicioContrato, dataFimContrato].filter((d) => String(d ?? '').trim()).join(' → ') || 'Sem datas',
        alert: ![dataInicioContrato, dataFimContrato].some((d) => String(d ?? '').trim()),
      },
      {
        variant: 'proprietario',
        label: 'Proprietário',
        value: String(proprietario ?? '').trim() || 'Não vinculado',
        alert: !String(proprietario ?? '').trim(),
      },
      {
        variant: 'inquilino',
        label: 'Inquilino',
        value: String(inquilino ?? '').trim() || 'Não informado',
        alert: !String(inquilino ?? '').trim(),
      },
    ],
    [valorLocacao, diaPagAluguel, dataInicioContrato, dataFimContrato, proprietario, inquilino],
  );

  const utilidadeRows = useMemo(
    () => [
      {
        key: 'agua',
        label: 'Água',
        numero: aguaNumero,
        dataCons: dataConsAgua,
        debito: existeDebAgua,
        diaVenc: diaVencAgua,
      },
      {
        key: 'energia',
        label: 'Energia',
        numero: energiaNumero,
        dataCons: dataConsEnergia,
        debito: existeDebEnergia,
        diaVenc: diaVencEnergia,
      },
      {
        key: 'gas',
        label: 'Gás',
        numero: gasNumero,
        dataCons: dataConsGas,
        debito: existeDebGas,
        diaVenc: diaVencGas,
      },
      {
        key: 'cond',
        label: 'Condomínio / repasse',
        numero: '',
        dataCons: dataConsDebitoCond,
        debito: existeDebitoCond,
        diaVenc: diaRepasse,
        readOnlyDebito: false,
      },
    ],
    [
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
      dataConsDebitoCond,
      existeDebitoCond,
      diaRepasse,
    ],
  );

  function handleUtilidadeChange(key, field, value) {
    const map = {
      agua: {
        numero: setAguaNumero,
        dataCons: setDataConsAgua,
        debito: setExisteDebAgua,
        diaVenc: setDiaVencAgua,
      },
      energia: {
        numero: setEnergiaNumero,
        dataCons: setDataConsEnergia,
        debito: setExisteDebEnergia,
        diaVenc: setDiaVencEnergia,
      },
      gas: {
        numero: setGasNumero,
        dataCons: setDataConsGas,
        debito: setExisteDebGas,
        diaVenc: setDiaVencGas,
      },
      cond: {
        dataCons: setDataConsDebitoCond,
        debito: setExisteDebitoCond,
        diaVenc: setDiaRepasse,
      },
    };
    const setter = map[key]?.[field];
    if (setter) setter(value);
  }

  const showGerenciarIptu = featureFlags.useApiImoveis && FEATURE_IPTU_NOVO && Number(_apiImovelId) > 0;

  return (
    <>
      {(apiLoading || apiError) && (
        <div className="px-5 py-3 border-b border-slate-200 dark:border-white/[0.08] bg-slate-50/80 dark:bg-white/[0.03] text-sm">
          {apiLoading ? <p className="text-indigo-700 dark:text-indigo-300">Carregando cadastro do imóvel...</p> : null}
          {apiError ? <p className="text-red-700 dark:text-red-300">{apiError}</p> : null}
        </div>
      )}

      <div className="p-5 sm:p-6 md:p-8 space-y-5 md:space-y-6">
        <ImoveisStickyHeader
          imovelId={imovelId}
          imovelOcupado={imovelOcupado}
          unidadeResumo={unidadeResumo}
          valorLocacao={valorLocacao}
          inquilinoNome={inquilino}
          apiSaving={apiSaving}
          onSalvar={onSalvar}
          onAbrirProc={onAbrirProc}
          onContaCorrente={onContaCorrente}
          contaCorrenteDisabled={contaCorrenteDisabled}
          contaCorrenteTitle={contaCorrenteTitle}
          onGerenciarIptu={onGerenciarIptu}
          showGerenciarIptu={showGerenciarIptu}
          onRelatorio={onRelatorio}
          showRelatorio={featureFlags.useApiImoveis}
          onFechar={onFechar}
        />

        <ImoveisSummaryCards cards={summaryCards} />

        <AccordionSection
          id="identificacao"
          title="Identificação"
          subtitle="Número do imóvel, ocupação e vínculo com Processos"
          icon={Fingerprint}
          accent={IMOVEIS_SECTION_ACCENTS.identificacao}
          defaultOpen
        >
          <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
            <Field label={featureFlags.useApiImoveis ? 'Número do imóvel' : 'Imóvel'} className="w-[min(100%,17.5rem)] shrink-0">
              <CampoNumeroComContador
                value={imovelId}
                onChange={setImovelId}
                min={1}
                ariaLabel="Número do imóvel"
                hint={
                  featureFlags.useApiImoveis && _apiImovelId
                    ? `Cadastro interno #${_apiImovelId}`
                    : featureFlags.useApiImoveis
                      ? 'Mesmo número da coluna A da planilha'
                      : ''
                }
                onBlur={() => setImovelId((i) => Math.max(1, Number(i) || 1))}
              />
            </Field>

            <fieldset className="border border-slate-300/90 dark:border-white/[0.1] rounded-xl px-4 py-2.5 bg-white dark:bg-[#141c2c]/80 shrink-0 shadow-sm">
              <legend className="text-xs font-semibold text-slate-700 dark:text-slate-300 px-1.5">Imóvel ocupado</legend>
              <div className="flex gap-5 pt-0.5">
                <label className="flex items-center gap-2 text-sm cursor-pointer text-slate-700 dark:text-slate-200">
                  <input
                    type="radio"
                    name="ocupado"
                    checked={imovelOcupado}
                    onChange={() => setImovelOcupado(true)}
                    className="text-cyan-600"
                  />
                  Sim
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer text-slate-700 dark:text-slate-200">
                  <input
                    type="radio"
                    name="ocupado"
                    checked={!imovelOcupado}
                    onChange={() => setImovelOcupado(false)}
                    className="text-cyan-600"
                  />
                  Não
                </label>
              </div>
            </fieldset>

            <Field label="Código" className="w-[7.5rem] shrink-0">
              <input
                type="text"
                inputMode="numeric"
                maxLength={8}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 8))}
                className={`${imoveisInputClass} font-mono tabular-nums text-center tracking-tight`}
              />
            </Field>
            <Field label="Proc." className="w-[5.5rem] shrink-0">
              <input
                type="text"
                value={proc}
                onChange={(e) => setProc(e.target.value)}
                className={imoveisInputClass}
              />
            </Field>
          </div>

          {featureFlags.useApiImoveis ? (
            <div className="pt-4 border-t border-slate-200/90 dark:border-white/[0.08] w-full">
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
                      className={`${imoveisInputClass} pl-9`}
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
                            onClick={() => onSelecionarImovelPesquisa(im)}
                          >
                            <span className="font-medium text-slate-900 dark:text-slate-50">
                              {im.condominio?.trim() ? im.condominio : '—'}
                              {im.unidade?.trim() ? (
                                <span className="font-normal text-slate-600 dark:text-slate-400"> · {im.unidade}</span>
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
            <p className="text-[11px] text-slate-600 dark:text-slate-400 pt-3 border-t border-slate-200/90 dark:border-white/[0.08] w-full leading-relaxed">
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
        </AccordionSection>

        <AccordionSection
          id="endereco"
          title="Endereço"
          subtitle="Localização, condomínio e unidade"
          icon={MapPin}
          accent={IMOVEIS_SECTION_ACCENTS.endereco}
        >
          <Field label="Endereço">
            <EnderecoComAcoes
              endereco={endereco}
              onChange={setEndereco}
              onCopy={onCopiarEndereco}
              mapsUrl={mapsUrl}
            />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4 sm:gap-5">
            <Field label="Condomínio" className="sm:col-span-2 lg:col-span-6">
              <input type="text" value={condominio} onChange={(e) => setCondominio(e.target.value)} className={imoveisInputClass} />
            </Field>
            <Field label="Unidade" className="lg:col-span-4">
              <input type="text" value={unidade} onChange={(e) => setUnidade(e.target.value)} className={imoveisInputClass} />
            </Field>
            <Field label="Garagens" className="lg:col-span-2">
              <input type="text" value={garagens} onChange={(e) => setGaragens(e.target.value)} className={imoveisInputClass} />
            </Field>
          </div>
        </AccordionSection>

        <AccordionSection
          id="locacao-garantia"
          title="Locação e Garantia"
          subtitle={FEATURE_IPTU_NOVO ? 'Valores, garantia e inscrição imobiliária' : 'Valores, garantia e IPTU'}
          icon={CircleDollarSign}
          accent={IMOVEIS_SECTION_ACCENTS.locacao}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            <Field label="Garantia">
              <input type="text" value={garantia} onChange={(e) => setGarantia(e.target.value)} className={imoveisInputClass} />
            </Field>
            <Field label="Valor da Garantia">
              <input type="text" value={valorGarantia} onChange={(e) => setValorGarantia(e.target.value)} className={imoveisInputClass} />
            </Field>
            <Field label="Valor da Locação">
              <input type="text" value={valorLocacao} onChange={(e) => setValorLocacao(e.target.value)} className={imoveisInputClass} />
            </Field>
            <Field label="Dia Pag. Aluguel">
              <input type="text" value={diaPagAluguel} onChange={(e) => setDiaPagAluguel(e.target.value)} className={imoveisInputClass} />
            </Field>
          </div>
          <div className="flex flex-wrap items-end gap-3 pt-1">
            <Field label="Data pag. 1ª Tx. Cond." className="w-full sm:w-44">
              <input
                type="text"
                value={dataPag1TxCond}
                onChange={(e) => {
                  const v = e.target.value;
                  setDataPag1TxCond(resolverAliasHojeEmTexto(v, 'br') ?? v);
                }}
                placeholder="dd/mm/aaaa ou hj"
                className={imoveisInputClass}
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 items-end pt-5 border-t border-slate-200/90 dark:border-white/[0.08]">
            <Field label="Inscrição Imobiliária" className="sm:col-span-2">
              <input
                type="text"
                value={inscricaoImobiliaria}
                onChange={(e) => setInscricaoImobiliaria(e.target.value)}
                className={imoveisInputClass}
              />
            </Field>
            {!FEATURE_IPTU_NOVO ? (
              <>
                <Field label="Existe Deb. IPTU">
                  <input type="text" value={existeDebIptu} onChange={(e) => setExisteDebIptu(e.target.value)} className={imoveisInputClass} />
                </Field>
                <Field label="Data Cons.">
                  <input type="text" value={dataConsIptu} onChange={(e) => setDataConsIptu(e.target.value)} className={imoveisInputClass} />
                </Field>
                <div className="sm:col-span-2 lg:col-span-1 flex pb-0.5">
                  <button type="button" onClick={onAbrirIptu} className={`${imoveisBtnPrimary} w-full sm:w-auto`}>
                    IPTU
                  </button>
                </div>
              </>
            ) : showGerenciarIptu ? (
              <div className="sm:col-span-2 flex pb-0.5">
                <button type="button" onClick={onGerenciarIptu} className={`${imoveisBtnPrimary} w-full sm:w-auto`}>
                  Gerenciar IPTU
                </button>
              </div>
            ) : null}
          </div>
        </AccordionSection>

        <AccordionSection
          id="contrato"
          title="Contrato"
          subtitle="Vigência do contrato de locação"
          icon={FileText}
          accent={IMOVEIS_SECTION_ACCENTS.contrato}
        >
          <div className="flex flex-wrap items-end gap-4">
            <Field label="Data início" className="w-full sm:w-40">
              <input
                type="text"
                value={dataInicioContrato}
                onChange={(e) => setDataInicioContrato(e.target.value)}
                className={imoveisInputClass}
              />
            </Field>
            <Field label="Data fim" className="w-full sm:w-40">
              <input
                type="text"
                value={dataFimContrato}
                onChange={(e) => setDataFimContrato(e.target.value)}
                className={imoveisInputClass}
              />
            </Field>
          </div>
        </AccordionSection>

        <AccordionSection
          id="utilidades"
          title="Utilidades"
          subtitle="Água, energia, gás e condomínio"
          icon={Layers}
          accent={IMOVEIS_SECTION_ACCENTS.utilidades}
        >
          <TabelaUtilidades rows={utilidadeRows} onChange={handleUtilidadeChange} />
        </AccordionSection>

        <AccordionSection
          id="dados-bancarios"
          title="Dados bancários"
          subtitle="Conta para repasse e PIX"
          icon={Landmark}
          accent={IMOVEIS_SECTION_ACCENTS.bancarios}
          defaultOpen={false}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            <Field label="Banco">
              <input type="text" value={banco} onChange={(e) => setBanco(e.target.value)} className={imoveisInputClass} />
            </Field>
            <Field label="Nº Banco">
              <input type="text" value={numeroBanco} onChange={(e) => setNumeroBanco(e.target.value)} className={imoveisInputClass} />
            </Field>
            <Field label="Agência">
              <input type="text" value={agencia} onChange={(e) => setAgencia(e.target.value)} className={imoveisInputClass} />
            </Field>
            <Field label="Conta">
              <input type="text" value={conta} onChange={(e) => setConta(e.target.value)} className={imoveisInputClass} />
            </Field>
            <Field label="CPF">
              <input type="text" value={cpfBanco} onChange={(e) => setCpfBanco(e.target.value)} className={imoveisInputClass} />
            </Field>
            <Field label="Chave Pix" className="lg:col-span-2">
              <input type="text" value={chavePix} onChange={(e) => setChavePix(e.target.value)} className={imoveisInputClass} />
            </Field>
            <Field label="Titular" className="sm:col-span-2 lg:col-span-4">
              <input type="text" value={titular} onChange={(e) => setTitular(e.target.value)} className={imoveisInputClass} />
            </Field>
          </div>
        </AccordionSection>

        <AccordionSection
          id="partes"
          title="Partes"
          subtitle="Proprietário e inquilino"
          icon={Users}
          accent={IMOVEIS_SECTION_ACCENTS.partes}
          defaultOpen
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-start">
            <CardParte
              tipo="proprietario"
              titulo="Proprietário"
              numeroPessoa={proprietarioNumeroPessoa}
              onNumeroPessoaChange={setProprietarioNumeroPessoa}
              nome={proprietario}
              cpf={proprietarioCpf}
              contato={proprietarioContato}
              carregando={proprietarioCadastroCarregando}
              erro={proprietarioCadastroErro}
              onVincular={onVincularProprietario}
            />
            <CardParte
              tipo="inquilino"
              titulo="Inquilino"
              numeroPessoa={inquilinoNumeroPessoa}
              onNumeroPessoaChange={setInquilinoNumeroPessoa}
              nome={inquilino}
              cpf={inquilinoCpf}
              contato={inquilinoContato}
              carregando={inquilinoCadastroCarregando}
              erro={inquilinoCadastroErro}
              onVincular={onVincularInquilino}
            />
          </div>
        </AccordionSection>

        <AccordionSection
          id="observacoes-links"
          title="Observações e links"
          subtitle="Notas internas e vistoria"
          icon={StickyNote}
          accent={IMOVEIS_SECTION_ACCENTS.observacoes}
          defaultOpen={false}
        >
          <fieldset className="rounded-xl border border-amber-200/60 dark:border-amber-500/20 bg-amber-50/40 dark:bg-amber-950/20 p-4 sm:p-5">
            <legend className="text-sm font-semibold text-slate-800 dark:text-amber-100/95 px-1.5">
              Observações sobre o inquilino
            </legend>
            <p className="text-[11px] text-slate-600 dark:text-amber-200/70 mb-3 leading-snug">
              Notas internas sobre a locação; leitura confortável em qualquer tema.
            </p>
            <textarea
              value={observacoesInquilino}
              onChange={(e) => setObservacoesInquilino(e.target.value)}
              rows={5}
              className={`${imoveisInputClass} resize-y w-full min-h-[7rem] leading-relaxed bg-white/90 dark:bg-[#0d1018]/70`}
            />
          </fieldset>
          <Field label="Link Vistoria" className="max-w-full pt-2">
            <input type="text" value={linkVistoria} onChange={(e) => setLinkVistoria(e.target.value)} className={imoveisInputClass} />
          </Field>
        </AccordionSection>
      </div>

      <ImoveisToast message={apiSuccess} onClose={() => setApiSuccess('')} />
    </>
  );
}
