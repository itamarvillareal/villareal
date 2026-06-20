export const MODELO_CONTRATO_HONORARIOS = 'honorarios';
export const MODELO_CONTRATO_ALUGUEL = 'aluguel';

export const CONTRATADO_HONORARIOS_NOME = 'Dr. ITAMAR ALEXANDRE FELIX VILLA REAL JUNIOR';

export const CLAUSULA_3_REMUNERACAO_PADRAO =
  'Em REMUNERAÇÃO desses serviços, o advogado Contratado receberá do Contratante os honorários líquidos e certos na importância de 35% (trinta e cinco por cento) calculados sobre o montante proveito econômico da demanda (inclusive extrajudicial);';

export const FORMA_ASSINATURA_DUAS_VIAS = 'duas_vias';
export const FORMA_ASSINATURA_DIGITAL = 'via_digital';

export const FORMAS_ASSINATURA_CONTRATO = [
  {
    id: FORMA_ASSINATURA_DUAS_VIAS,
    label: 'Impresso em duas vias de igual teor',
    descricao: 'Fecho conforme modelo em papel (duas vias, testemunhas).',
  },
  {
    id: FORMA_ASSINATURA_DIGITAL,
    label: 'Assinatura em via digital',
    descricao: 'Fecho adaptado para assinatura eletrônica/digital.',
  },
];

export const MODELOS_CONTRATO = [
  {
    id: MODELO_CONTRATO_HONORARIOS,
    label: 'Honorários advocatícios',
    descricao: 'Contratante = cliente; contratado fixo (Itamar Villa Real Junior).',
  },
  {
    id: MODELO_CONTRATO_ALUGUEL,
    label: 'Locação (aluguel)',
    descricao: 'Locador = parte autora do processo; locatário = partes opostas (réu).',
  },
];

export function rotuloModeloContrato(modeloId) {
  return MODELOS_CONTRATO.find((m) => m.id === modeloId)?.label ?? 'Contrato';
}
