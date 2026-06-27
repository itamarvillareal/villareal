import { useRef } from 'react';
import { calcularPosicaoCursorMoedaBr, editarMoedaCampo } from '../../utils/moneyBr.js';

/**
 * Campo monetário pt-BR (ex.: 1700 → 1.700,00 ao sair do campo; enquanto digita, sem forçar «,00»).
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
  const inputRef = useRef(null);

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      value={value ?? ''}
      placeholder={placeholder}
      className={className}
      onChange={(e) => {
        const el = e.target;
        const cursor = el.selectionStart ?? el.value.length;
        const textoAnterior = el.value;
        const proximo = editarMoedaCampo(textoAnterior);
        onChange(proximo);
        requestAnimationFrame(() => {
          const input = inputRef.current;
          if (!input) return;
          const pos = calcularPosicaoCursorMoedaBr(textoAnterior, cursor, proximo);
          input.setSelectionRange(pos, pos);
        });
      }}
      onBlur={(e) => {
        const norm = editarMoedaCampo(e.target.value, { finalizar: true });
        onChange(norm);
        onBlurExtra?.(norm);
      }}
      {...rest}
    />
  );
}
