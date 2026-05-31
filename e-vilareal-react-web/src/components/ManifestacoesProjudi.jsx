import { PublicacoesEmail } from './PublicacoesEmail.jsx';

/**
 * Tela «Movimentações Email»: movimentações importadas por email do Projudi TJGO
 * (sistema-projudi@tjgo.jus.br) e do PUSH dos TRTs/PJe (ex.: nao-responda@trt18.jus.br).
 */
export function ManifestacoesProjudi() {
  return <PublicacoesEmail variant="projudi" />;
}
