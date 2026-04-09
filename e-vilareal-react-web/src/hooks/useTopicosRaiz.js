import { useState, useEffect } from 'react';
import { featureFlags } from '../config/featureFlags.js';
import { fetchTopicosHierarchy } from '../repositories/topicosRepository.js';

/** Estrutura mínima quando não há dados da API (sem árvore estática de demonstração). */
const TOPICOS_RAIZ_VAZIA = { id: '_raiz', label: 'Início', children: [] };

/**
 * Hierarquia: com `VITE_USE_API_TOPICOS=true` busca na API; senão exibe raiz vazia até ativar a API.
 */
export function useTopicosRaiz() {
  const [raiz, setRaiz] = useState(() => (featureFlags.useApiTopicos ? null : TOPICOS_RAIZ_VAZIA));
  const [erro, setErro] = useState(null);
  const [carregando, setCarregando] = useState(Boolean(featureFlags.useApiTopicos));

  useEffect(() => {
    if (!featureFlags.useApiTopicos) {
      return;
    }
    let cancel = false;
    setCarregando(true);
    setErro(null);
    fetchTopicosHierarchy()
      .then((data) => {
        if (!cancel) {
          setRaiz(data);
          setCarregando(false);
        }
      })
      .catch((e) => {
        console.error(e);
        if (!cancel) {
          setErro(e);
          setRaiz(TOPICOS_RAIZ_VAZIA);
          setCarregando(false);
        }
      });
    return () => {
      cancel = true;
    };
  }, []);

  return { raiz, carregando, erro, usandoApi: featureFlags.useApiTopicos };
}
