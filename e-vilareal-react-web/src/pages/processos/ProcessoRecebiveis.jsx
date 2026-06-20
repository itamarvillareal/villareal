import { Navigate, useLocation } from 'react-router-dom';
import { RecebiveisConsolidados } from '../../components/RecebiveisConsolidados.jsx';
import {
  CHAVE_API_NUMERO_INTERNO_PROCESSO,
  resolverIntentNavegacaoProcessosDeRota,
} from '../../domain/camposProcessoCliente.js';
import { padCliente } from '../../data/processosDadosRelatorio.js';

function resolverProcessoApiId(location) {
  const intent = resolverIntentNavegacaoProcessosDeRota(location);
  if (intent?.processoApiId) return intent.processoApiId;
  return null;
}

export function ProcessoRecebiveis() {
  const location = useLocation();
  const processoApiId = resolverProcessoApiId(location);

  if (!processoApiId) {
    const intent = resolverIntentNavegacaoProcessosDeRota(location);
    if (intent?.hasCod) {
      return <Navigate to="/processos" replace state={location.state ?? undefined} search={location.search} />;
    }
    return <Navigate to="/processos" replace />;
  }

  const intent = resolverIntentNavegacaoProcessosDeRota(location);
  const codigoCliente = intent?.hasCod ? padCliente(intent.codRaw) : null;
  const numeroInternoRaw = intent?.hasProcKey ? intent.procRaw : location.state?.[CHAVE_API_NUMERO_INTERNO_PROCESSO];
  const numeroInterno =
    numeroInternoRaw != null && String(numeroInternoRaw).trim() !== '' ? Number(numeroInternoRaw) : null;

  return (
    <RecebiveisConsolidados
      key={`${processoApiId}-${codigoCliente ?? ''}-${numeroInterno ?? ''}`}
      processoId={processoApiId}
      contextoProcesso={{
        codigoCliente,
        numeroInterno: Number.isFinite(numeroInterno) ? numeroInterno : null,
      }}
      modoProcesso
    />
  );
}

export default ProcessoRecebiveis;
