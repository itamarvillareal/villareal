import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildRouterStateChaveClienteProcesso } from '../../domain/camposProcessoCliente.js';
import { CalculosAcordosPanel } from './CalculosAcordosPanel.jsx';

export function CalculosAcordosPage() {
  const navigate = useNavigate();

  const abrirRodada = useCallback(
    ({ codigoCliente, numeroProcesso, dimensao, aba = 'Parcelamento' }) => {
      navigate('/calculos', {
        state: {
          ...buildRouterStateChaveClienteProcesso(codigoCliente, numeroProcesso),
          dimensao,
          abaCalculos: aba,
        },
      });
    },
    [navigate]
  );

  return (
    <div className="min-h-0 flex flex-col flex-1 bg-slate-50 dark:bg-gradient-to-b dark:from-[#0a0d12] dark:via-[#0c1017] dark:to-[#0e141d]">
      <CalculosAcordosPanel onAbrirRodada={abrirRodada} />
    </div>
  );
}
