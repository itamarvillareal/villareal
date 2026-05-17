package br.com.vilareal.processo.api.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Nomes para exibição em listagens (ex.: módulo Publicações) alinhados à tela Processos. */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ProcessoPartesVinculoTexto {

    private String parteCliente;
    private String parteOposta;
}
