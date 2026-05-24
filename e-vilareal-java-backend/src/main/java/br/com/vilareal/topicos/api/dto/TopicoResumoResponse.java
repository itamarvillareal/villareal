package br.com.vilareal.topicos.api.dto;

public class TopicoResumoResponse {

    private Long id;
    private String categoria;
    private String subcategoria;
    private String nome;
    private String chaveNavegacao;
    private String tipoFormatacao;
    private Integer ordem;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getCategoria() {
        return categoria;
    }

    public void setCategoria(String categoria) {
        this.categoria = categoria;
    }

    public String getSubcategoria() {
        return subcategoria;
    }

    public void setSubcategoria(String subcategoria) {
        this.subcategoria = subcategoria;
    }

    public String getNome() {
        return nome;
    }

    public void setNome(String nome) {
        this.nome = nome;
    }

    public String getChaveNavegacao() {
        return chaveNavegacao;
    }

    public void setChaveNavegacao(String chaveNavegacao) {
        this.chaveNavegacao = chaveNavegacao;
    }

    public String getTipoFormatacao() {
        return tipoFormatacao;
    }

    public void setTipoFormatacao(String tipoFormatacao) {
        this.tipoFormatacao = tipoFormatacao;
    }

    public Integer getOrdem() {
        return ordem;
    }

    public void setOrdem(Integer ordem) {
        this.ordem = ordem;
    }
}
