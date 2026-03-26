package br.com.vilareal.topicos.api.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class TopicoNoDto {

    private String id;
    private String label;
    private Boolean selecaoUnica;
    private List<TopicoNoDto> children;
    private List<TopicoItemDto> items;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getLabel() {
        return label;
    }

    public void setLabel(String label) {
        this.label = label;
    }

    public Boolean getSelecaoUnica() {
        return selecaoUnica;
    }

    public void setSelecaoUnica(Boolean selecaoUnica) {
        this.selecaoUnica = selecaoUnica;
    }

    public List<TopicoNoDto> getChildren() {
        return children;
    }

    public void setChildren(List<TopicoNoDto> children) {
        this.children = children;
    }

    public List<TopicoItemDto> getItems() {
        return items;
    }

    public void setItems(List<TopicoItemDto> items) {
        this.items = items;
    }
}
