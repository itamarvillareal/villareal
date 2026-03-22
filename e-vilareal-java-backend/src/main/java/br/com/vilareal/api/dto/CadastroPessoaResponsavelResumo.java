package br.com.vilareal.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Dados mínimos do responsável/representante para exibição e futura qualificação contratual.
 */
@Schema(description = "Resumo da pessoa vinculada como responsável")
public class CadastroPessoaResponsavelResumo {

    @Schema(description = "ID da pessoa responsável")
    private Long id;

    @Schema(description = "Nome ou razão social")
    private String nome;

    @Schema(description = "CPF ou CNPJ (somente dígitos armazenados na base)")
    private String cpf;

    /**
     * FISICA | JURIDICA — inferido pelo tamanho do documento quando não houver coluna dedicada.
     */
    @Schema(description = "Tipo de pessoa para regras futuras", example = "FISICA")
    private String tipoPessoa;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getNome() {
        return nome;
    }

    public void setNome(String nome) {
        this.nome = nome;
    }

    public String getCpf() {
        return cpf;
    }

    public void setCpf(String cpf) {
        this.cpf = cpf;
    }

    public String getTipoPessoa() {
        return tipoPessoa;
    }

    public void setTipoPessoa(String tipoPessoa) {
        this.tipoPessoa = tipoPessoa;
    }
}
