import { fmtDataAcerto } from './acertoUtils.js';

export const STORAGE_GUIA_OCULTO = 'acerto-guia-oculto';

export function isGuiaOculto() {
  try {
    return localStorage.getItem(STORAGE_GUIA_OCULTO) === '1';
  } catch {
    return false;
  }
}

export function ocultarGuia() {
  try {
    localStorage.setItem(STORAGE_GUIA_OCULTO, '1');
  } catch {
    /* ignore */
  }
}

export function mostrarGuiaNovamente() {
  try {
    localStorage.removeItem(STORAGE_GUIA_OCULTO);
  } catch {
    /* ignore */
  }
}

/**
 * @param {{ periodosResumo?: object, resumoProcessos?: object, periodoAtivo?: object }} ctx
 */
export function calcularProximoPassoAcerto({ periodosResumo, resumoProcessos, periodoAtivo }) {
  const periodos = periodosResumo?.periodos ?? [];
  const aberto = periodos.find((p) => p.status === 'ABERTO');
  const cards = periodos.filter((p) => p.status === 'FECHADO_GRUPO' || p.tipoPeriodo === 'CARD');
  const procConf = Number(resumoProcessos?.processosConferidos ?? 0);
  const procTotal = Number(resumoProcessos?.totalProcessos ?? 0);
  const lancSemConf = Number(resumoProcessos?.lancamentosNaoConferidos ?? 0);
  const procsComPend = (resumoProcessos?.processos ?? []).filter((p) => Number(p.pendentes) > 0).length;

  if (periodoAtivo && periodoAtivo.status !== 'ABERTO') {
    if (periodoAtivo.status === 'FECHADO_GRUPO' || periodoAtivo.tipoPeriodo === 'CARD') {
      return {
        titulo: 'Consultando um card fechado',
        texto: 'Este card já está compensado (soma zero). Use só para consulta — volte ao período aberto para continuar o trabalho.',
      };
    }
    return {
      titulo: 'Período histórico selecionado',
      texto: 'Somente leitura. Selecione o período aberto (verde) para conferir e compensar lançamentos.',
    };
  }

  if (procTotal === 0 && !aberto) {
    return {
      titulo: 'Sem movimento no recorte',
      texto: 'Não há processos neste período. Verifique o cliente selecionado ou ajuste os filtros de data.',
    };
  }

  if (lancSemConf > 0 && procConf === 0) {
    return {
      titulo: 'Comece pela conferência',
      texto: `Há ${procTotal.toLocaleString('pt-BR')} processo(s) e ${lancSemConf.toLocaleString('pt-BR')} lançamento(s) sem conferir. Marque «só não conferidos», expanda um proc, compare com Proc/CC e clique no círculo para conferir.`,
      acaoSugerida: 'filtro_nao_conferidos',
    };
  }

  if (lancSemConf > 0) {
    return {
      titulo: 'Continue proc a proc',
      texto: `${procConf.toLocaleString('pt-BR')} de ${procTotal.toLocaleString('pt-BR')} processos conferidos · ${lancSemConf.toLocaleString('pt-BR')} lanç. restantes. Expanda o próximo proc não conferido e repita.`,
      acaoSugerida: 'filtro_nao_conferidos',
    };
  }

  if (procsComPend > 0) {
    return {
      titulo: 'Compensar blocos que zeram',
      texto: `${procsComPend.toLocaleString('pt-BR')} processo(s) ainda têm lançamentos pendentes (sem grupo). Selecione lançamentos que somem zero e use «Compensar seleção» na barra inferior.`,
    };
  }

  if (aberto) {
    const desde = aberto.dataInicio ? fmtDataAcerto(aberto.dataInicio) : '—';
    return {
      titulo: 'Período aberto conferido',
      texto: `Recorte desde ${desde} sem pendências de conferência. Quando estiver pronto, use a Ficha do Acerto → Iniciar → Fechar para o fechamento formal (PDF).`,
    };
  }

  return {
    titulo: 'Selecione o período aberto',
    texto: 'Clique no bloco verde «Período aberto» acima para filtrar a tabela de trabalho.',
  };
}
