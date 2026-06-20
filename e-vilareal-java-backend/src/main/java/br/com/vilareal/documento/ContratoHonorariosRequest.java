package br.com.vilareal.documento;

import java.time.LocalDate;
import java.util.List;

public record ContratoHonorariosRequest(
        Long pessoaId,
        /** IDs adicionais quando há mais de um contratante (flexão plural na Cláusula 3ª). */
        List<Long> contratantePessoaIds,
        String codigoCliente,
        Integer numeroInterno,
        String cidadeEstado,
        LocalDate data,
        Long processoId,
        /** {@code duas_vias} (padrão) ou {@code via_digital}. */
        String formaAssinatura,
        /** Texto livre do OBJETO (Cláusula 2ª), ex.: pedido de indenização e parte contrária. */
        String objetoContrato,
        /** Corpo da Cláusula 3ª (remuneração), sem o prefixo «Cláusula 3ª.». Ignorado se {@code clausula3Dados} informado. */
        String clausula3Remuneracao,
        /** Dados estruturados da remuneração (modal). */
        ContratoHonorariosClausula3Dados clausula3Dados,
        /** Quando true (padrão com clausula3Dados), persiste contrato e gera recebíveis se configurado. */
        Boolean persistirDados) {}
