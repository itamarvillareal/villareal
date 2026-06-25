import { lazy } from 'react';

/** Único lazy do formulário Processos — evita chunks duplicados (Agenda embed + rota /processos). */
export const LazyProcessos = lazy(() =>
  import('../components/Processos.jsx').then((module) => ({ default: module.Processos })),
);
