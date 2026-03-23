package br.com.vilareal.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import org.springframework.data.domain.Page;

import java.util.List;

/**
 * Envelope JSON estável para o relatório paginado (evita falhas de serialização de {@link Page} no Jackson).
 */
@Schema(description = "Página do relatório de auditoria")
public class AuditoriaAtividadePaginaResponse {

    private List<AuditoriaAtividadeResponse> content;
    private long totalElements;
    private int totalPages;
    private int size;
    private int number;
    private boolean first;
    private boolean last;
    private boolean empty;

    public static AuditoriaAtividadePaginaResponse of(Page<AuditoriaAtividadeResponse> page) {
        AuditoriaAtividadePaginaResponse r = new AuditoriaAtividadePaginaResponse();
        r.setContent(page.getContent());
        r.setTotalElements(page.getTotalElements());
        r.setTotalPages(page.getTotalPages());
        r.setSize(page.getSize());
        r.setNumber(page.getNumber());
        r.setFirst(page.isFirst());
        r.setLast(page.isLast());
        r.setEmpty(page.isEmpty());
        return r;
    }

    public List<AuditoriaAtividadeResponse> getContent() {
        return content;
    }

    public void setContent(List<AuditoriaAtividadeResponse> content) {
        this.content = content;
    }

    public long getTotalElements() {
        return totalElements;
    }

    public void setTotalElements(long totalElements) {
        this.totalElements = totalElements;
    }

    public int getTotalPages() {
        return totalPages;
    }

    public void setTotalPages(int totalPages) {
        this.totalPages = totalPages;
    }

    public int getSize() {
        return size;
    }

    public void setSize(int size) {
        this.size = size;
    }

    public int getNumber() {
        return number;
    }

    public void setNumber(int number) {
        this.number = number;
    }

    public boolean isFirst() {
        return first;
    }

    public void setFirst(boolean first) {
        this.first = first;
    }

    public boolean isLast() {
        return last;
    }

    public void setLast(boolean last) {
        this.last = last;
    }

    public boolean isEmpty() {
        return empty;
    }

    public void setEmpty(boolean empty) {
        this.empty = empty;
    }
}
