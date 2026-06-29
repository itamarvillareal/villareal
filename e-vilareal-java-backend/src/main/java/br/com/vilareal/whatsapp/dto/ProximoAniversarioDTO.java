package br.com.vilareal.whatsapp.dto;

public record ProximoAniversarioDTO(
        Long pessoaId,
        String pessoaNome,
        int diaAniversario,
        int mesAniversario,
        String telefone,
        boolean temTelefone,
        boolean jaEnviouEsteAno,
        int diasParaAniversario) {}
