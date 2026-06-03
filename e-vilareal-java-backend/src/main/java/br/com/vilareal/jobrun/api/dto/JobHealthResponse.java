package br.com.vilareal.jobrun.api.dto;

import java.time.Instant;
import java.util.List;

public record JobHealthResponse(Instant checkedAt, List<JobHealthItemResponse> jobs) {}
