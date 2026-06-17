import { NavLink } from 'react-router-dom';
import {
  BarChart3,
  CalendarClock,
  CircleDollarSign,
  FileText,
  Folder,
  Forward,
  Gavel,
  Mail,
  Megaphone,
  UserSearch,
} from 'lucide-react';
import { processosMenuPrimary } from '../../data/processosMenuSections.js';
import {
  classeItemProcessosSidebar,
  classeRotuloSecaoProcessos,
  PROCESSOS_MENU_TONES,
} from './processosSidebarMenuStyles.js';

const LUCIDE_POR_ID = {
  processos: Folder,
  'documentos/gerar': FileText,
  'processos/peticionamento-projudi': Gavel,
  'processos/publicacoes': Megaphone,
  'publicacoes-email': Mail,
  'processos/manifestacoes-projudi': Forward,
  'processos/consultas-periodicas': CalendarClock,
  'processos/monitoramento': UserSearch,
  relatorio: BarChart3,
  'relatorio-resultado-processos': CircleDollarSign,
};

/**
 * @param {string} itemId
 * @param {string} pathname
 */
export function rotaProcessosItemAtiva(itemId, pathname) {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (itemId === 'processos') {
    return path === '/processos';
  }
  return path === `/${itemId}` || path.startsWith(`/${itemId}/`);
}

function IconeItemProcessos({ id, tone, className }) {
  const Cmp = LUCIDE_POR_ID[id];
  const toneCls = PROCESSOS_MENU_TONES[tone]?.icon ?? PROCESSOS_MENU_TONES.blue.icon;
  if (!Cmp) return null;
  return <Cmp className={`${className ?? ''} ${toneCls}`} strokeWidth={1.75} aria-hidden />;
}

/**
 * @param {{
 *   sections: import('../../data/processosMenuSections.js').processosMenuSections,
 *   pode: (id: string) => boolean,
 *   pathname: string,
 *   onNavigate?: () => void,
 * }} props
 */
export function ProcessosSidebarSubmenu({ sections, pode, pathname, onNavigate }) {
  const mostrarPrincipal = pode(processosMenuPrimary.id);

  return (
    <div className="mt-0.5 space-y-0.5 pl-0.5">
      {mostrarPrincipal ? (
        <NavLink
          to="/processos"
          onClick={onNavigate}
          aria-current={rotaProcessosItemAtiva(processosMenuPrimary.id, pathname) ? 'page' : undefined}
          className={() =>
            classeItemProcessosSidebar(
              processosMenuPrimary.tone,
              rotaProcessosItemAtiva(processosMenuPrimary.id, pathname),
            )
          }
        >
          <IconeItemProcessos id={processosMenuPrimary.id} tone={processosMenuPrimary.tone} className="w-4 h-4 shrink-0" />
          <span className="leading-snug">{processosMenuPrimary.label}</span>
        </NavLink>
      ) : null}

      {sections.map((section) => {
        const itens = section.items.filter((item) => pode(item.id));
        if (itens.length === 0) return null;
        return (
          <div key={section.id} role="group" aria-label={section.label}>
            <p className={classeRotuloSecaoProcessos}>{section.label}</p>
            <div className="space-y-0.5">
              {itens.map((item) => {
                const ativo = rotaProcessosItemAtiva(item.id, pathname);
                return (
                  <NavLink
                    key={item.id}
                    to={`/${item.id}`}
                    onClick={onNavigate}
                    aria-current={ativo ? 'page' : undefined}
                    className={() => classeItemProcessosSidebar(section.tone, ativo)}
                  >
                    <IconeItemProcessos id={item.id} tone={section.tone} className="w-3.5 h-3.5 shrink-0" />
                    <span className="leading-snug">{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
