/** @typedef {'blue' | 'teal' | 'amber' | 'purple'} ProcessosMenuTone */

/** @type {Record<ProcessosMenuTone, { icon: string, active: string, idle: string, hover: string }>} */
export const PROCESSOS_MENU_TONES = {
  blue: {
    icon: 'text-[#185FA5] dark:text-[#6daeec]',
    idle:
      'bg-[#185FA5]/10 dark:bg-[#185FA5]/14 text-gray-700 dark:text-slate-300 border-l-[3px] border-transparent',
    hover: 'hover:bg-[#185FA5]/14 dark:hover:bg-[#185FA5]/18',
    active:
      'bg-[#185FA5]/16 dark:bg-[#185FA5]/22 text-[#124d87] dark:text-[#c5ddf5] border-l-[3px] border-[#185FA5] dark:border-[#6daeec]',
  },
  teal: {
    icon: 'text-[#0F6E56] dark:text-[#3d9e82]',
    idle:
      'bg-[#0F6E56]/10 dark:bg-[#0F6E56]/14 text-gray-700 dark:text-slate-300 border-l-[3px] border-transparent',
    hover: 'hover:bg-[#0F6E56]/14 dark:hover:bg-[#0F6E56]/18',
    active:
      'bg-[#0F6E56]/16 dark:bg-[#0F6E56]/22 text-[#0a5544] dark:text-[#b8e6d8] border-l-[3px] border-[#0F6E56] dark:border-[#3d9e82]',
  },
  amber: {
    icon: 'text-[#BA7517] dark:text-[#d9a24a]',
    idle:
      'bg-[#BA7517]/10 dark:bg-[#BA7517]/14 text-gray-700 dark:text-slate-300 border-l-[3px] border-transparent',
    hover: 'hover:bg-[#BA7517]/14 dark:hover:bg-[#BA7517]/18',
    active:
      'bg-[#BA7517]/16 dark:bg-[#BA7517]/22 text-[#8f5a12] dark:text-[#f5e2c0] border-l-[3px] border-[#BA7517] dark:border-[#d9a24a]',
  },
  purple: {
    icon: 'text-[#534AB7] dark:text-[#8f86e0]',
    idle:
      'bg-[#534AB7]/10 dark:bg-[#534AB7]/14 text-gray-700 dark:text-slate-300 border-l-[3px] border-transparent',
    hover: 'hover:bg-[#534AB7]/14 dark:hover:bg-[#534AB7]/18',
    active:
      'bg-[#534AB7]/16 dark:bg-[#534AB7]/22 text-[#3f388f] dark:text-[#d8d4f5] border-l-[3px] border-[#534AB7] dark:border-[#8f86e0]',
  },
};

/**
 * @param {ProcessosMenuTone} tone
 * @param {boolean} ativo
 */
export function classeItemProcessosSidebar(tone, ativo) {
  const t = PROCESSOS_MENU_TONES[tone] ?? PROCESSOS_MENU_TONES.blue;
  const estado = ativo ? t.active : `${t.idle} ${t.hover}`;
  return `flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] font-medium transition-colors duration-150 ${estado}`;
}

export const classeRotuloSecaoProcessos =
  'px-2 pt-2.5 pb-1 text-[10px] font-medium tracking-wide text-gray-500 dark:text-slate-500 select-none';
