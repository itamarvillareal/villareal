import { useRef } from 'react';
import {
  calcularPosicaoCursorDataBr,
  formatarDataBrInput,
  normalizarDataNascimentoBrAoBlur,
  resolverAliasHojeEmTexto,
} from '../../services/hjDateAliasService.js';

/**
 * Campo de data brasileira (dd/mm/aaaa) com barras automáticas e alias «hj».
 * Dia, mês e ano são editados por segmento para evitar deformação ao substituir dígitos.
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
  const inputRef = useRef(null);

  const handleChange = (e) => {
    const inputEl = e.target;
    const raw = inputEl.value;
    const selectionStart =
      typeof inputEl.selectionStart === 'number' ? inputEl.selectionStart : raw.length;
    const alias = resolverAliasHojeEmTexto(raw, 'br');
    const formatted = alias ?? formatarDataBrInput(raw);
    onChange(formatted);

    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      const pos = alias != null ? formatted.length : calcularPosicaoCursorDataBr(raw, formatted, selectionStart);
      const clamped = Math.max(0, Math.min(pos, String(formatted ?? '').length));
      try {
        el.setSelectionRange(clamped, clamped);
      } catch {
        // ignora
      }
    });
  };

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={value ?? ''}
      placeholder={placeholder}
      className={className}
      onChange={handleChange}
      onBlur={(e) => {
        const norm = normalizarDataNascimentoBrAoBlur(e.target.value);
        onChange(norm);
        onBlurExtra?.(norm);
      }}
      {...rest}
    />
  );
}
