import {
  formatarDataBrInput,
  normalizarDataNascimentoBrAoBlur,
  resolverAliasHojeEmTexto,
} from '../../services/hjDateAliasService.js';

/**
 * Campo de data brasileira (dd/mm/aaaa) com barras automáticas e alias «hj».
 * @param {{ value: string, onChange: (value: string) => void, className?: string, placeholder?: string, onBlurExtra?: (value: string) => void } & import('react').InputHTMLAttributes<HTMLInputElement>} props
 */
export function CampoDataBr({
  value,
  onChange,
  className,
  placeholder = 'dd/mm/aaaa ou hj',
  onBlurExtra,
  ...rest
}) {
  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={value ?? ''}
      placeholder={placeholder}
      className={className}
      onChange={(e) => {
        const v = e.target.value;
        onChange(resolverAliasHojeEmTexto(v, 'br') ?? formatarDataBrInput(v));
      }}
      onBlur={(e) => {
        const norm = normalizarDataNascimentoBrAoBlur(e.target.value);
        onChange(norm);
        onBlurExtra?.(norm);
      }}
      {...rest}
    />
  );
}
