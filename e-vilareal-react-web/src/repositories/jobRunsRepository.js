import { request } from '../api/httpClient.js';

export async function fetchJobsHealth() {
  return request('/api/jobs/health');
}

export async function fetchJobRuns({ jobName, status, page = 0, limit = 50 } = {}) {
  const params = new URLSearchParams();
  if (jobName) params.set('job_name', jobName);
  if (status) params.set('status', status);
  params.set('page', String(page));
  params.set('limit', String(limit));
  const qs = params.toString();
  return request(`/api/jobs/runs?${qs}`);
}
