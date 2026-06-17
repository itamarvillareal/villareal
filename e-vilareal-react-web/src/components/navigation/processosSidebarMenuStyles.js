/** @typedef {'blue' | 'teal' | 'amber' | 'purple'} ProcessosMenuTone */

/** @type {Record<ProcessosMenuTone, { icon: string, active: string, idle: string, hover: string }>} */
export const PROCESSOS_MENU_TONES = {
  blue: {
    icon: 'text-[#185FA5] dark:text-[#6daeec]',
    active:
      'bg-[#185FA5]/12 dark:bg-[#185FA5]/20 text-[#124d87] dark:text-[#c5ddf5] border-l-[3px] border-[#185FA5] dark:border-[#6daeec]',
    idle: 'text-gray-700 dark:text-slate-300 border-l-[3px] border-transparent',
    hover: 'hover:bg-[#185FA5]/6 dark:hover:bg-[#185FA5]/10',
  },
  teal: {
    icon: 'text-[#0F6E56] dark:text-[#3d9e82]',
    active:
      'bg-[#0F6E56]/12 dark:bg-[#0F6E56]/20 text-[#0a5544] dark:text-[#b8e6d8] border-l-[3px] border-[#0F6E56] dark:border-[#3d9e82]',
    idle: 'text-gray-700 dark:text-slate-300 border-l-[3px] border-transparent',
    hover: 'hover:bg-[#0F6E56]/6 dark:hover:bg-[#0F6E56]/10',
  },
  amber: {
    icon: 'text-[#BA7517] dark:text-[#d9a24a]',
    active:
      'bg-[#BA7517]/12 dark:bg-[#BA7517]/20 text-[#8f5a12] dark:text-[#f5e2c0] border-l-[3px] border-[#BA7517] dark:border-[#d9a24a]',
    idle: 'text-gray-700 dark:text-slate-300 border-l-[3px] border-transparent',
    hover: 'hover:bg-[#BA7517]/6 dark:hover:bg-[#BA7517]/10',
  },
  purple: {
    icon: 'text-[#534AB7] dark:text-[#8f86e0]',
    active:
      'bg-[#534AB7]/12 dark:bg-[#534AB7]/20 text-[#3f388f] dark:text-[#d8d4f5] border-l-[3px] border-[#534AB7] dark:border-[#8f86e0]',
    idle: 'text-gray-700 dark:text-slate-300 border-l-[3px] border-transparent',
    hover: 'hover:bg-[#534AB7]/6 dark:hover:bg-[#534AB7]/10',
  },
};

/**
 * @param {ProcessosMenuTone} tone
 * @param {boolean} ativo
 */
export function classeItemProcessosSidebar(tone, ativo) {
  const t = PROCESSOS_MENU_TONES[tone] ?? PROCESSOS_MENU_TONES.blue;
  return `flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] font-medium transition-colors duration-150 ${t.idle} ${t.hover} ${
    ativo ? t.active : ''
  }`;
}

export const classeRotuloSecaoProcessos =
  'px-2 pt-2.5 pb-1 text-[10px] font-medium tracking-wide text-gray-500 dark:text-slate-500 select-none';
