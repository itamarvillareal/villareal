import { createContext, useContext } from 'react';
import { useWhatsAppNotifications } from './hooks/useWhatsAppNotifications.js';
import { usuarioPodeAcessarModulo, getPerfilAtivoParaPermissoes } from '../../data/usuarioPermissoesStorage.js';

const WhatsAppNotificationContext = createContext(null);

export function WhatsAppNotificationProvider({ children }) {
  const perfilId = getPerfilAtivoParaPermissoes();
  const enabled = usuarioPodeAcessarModulo(perfilId, 'whatsapp/conversas');
  const value = useWhatsAppNotifications({ enabled });

  return (
    <WhatsAppNotificationContext.Provider value={value}>
      {children}
    </WhatsAppNotificationContext.Provider>
  );
}

export function useWhatsAppNotificationContext() {
  return useContext(WhatsAppNotificationContext);
}
