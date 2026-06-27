import { editarMoedaCampo } from '../../utils/moneyBr.js';

/**
 * Campo monetário pt-BR (ex.: 1700 → 1.700,00 ao digitar ou ao sair do campo).
 * @param {{ value: string, onChange: (value: string) => void, className?: string, placeholder?: string, onBlurExtra?: (value: string) => void } & import('react').InputHTMLAttributes<HTMLInputElement>} props
 */
export function CampoMoedaBr({
  value,
  onChange,
  className,
  placeholder = '0,00',
  onBlurExtra,
  ...rest
}) {
  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={value ?? ''}
      placeholder={placeholder}
      className={className}
      onChange={(e) => onChange(editarMoedaCampo(e.target.value))}
      onBlur={(e) => {
        const norm = editarMoedaCampo(e.target.value, { finalizar: true });
        onChange(norm);
        onBlurExtra?.(norm);
      }}
      {...rest}
    />
  );
}
