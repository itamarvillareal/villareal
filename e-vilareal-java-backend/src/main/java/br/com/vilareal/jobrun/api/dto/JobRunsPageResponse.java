package br.com.vilareal.jobrun.api.dto;

import java.util.List;

public record JobRunsPageResponse(
        List<JobRunItemResponse> content,
        int page,
        int size,
        long totalElements,
        int totalPages,
        boolean last) {}
