package br.com.vilareal.pessoa.infrastructure.persistence.projection;

/**
 * Linha retornada pela busca em lote de telefones no cadastro de pessoas
 * ({@code pessoa.telefone_* } + contatos tipo telefone).
 */
public interface PessoaTelefoneIndiceBatchRow {

    Long getPessoaId();

    String getNome();

    String getTelefoneDigitos();

    String getTelefoneSufixo8();

    String getContatoDigitos();

    String getContatoSufixo8();
}
