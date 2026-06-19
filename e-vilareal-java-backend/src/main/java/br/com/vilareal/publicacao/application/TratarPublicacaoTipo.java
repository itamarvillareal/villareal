package br.com.vilareal.publicacao.application;

public enum TratarPublicacaoTipo {
    INFORMATIVO,
    TERCEIRO,
    CUMPRIR_AGORA,
    CUMPRIR_DEPOIS;

    public static TratarPublicacaoTipo parse(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new IllegalArgumentException("tipo é obrigatório.");
        }
        return TratarPublicacaoTipo.valueOf(raw.trim().toUpperCase());
    }
}
