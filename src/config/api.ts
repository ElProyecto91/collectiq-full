// URL base de la API — Cloudflare Workers
export const API_BASE = 'https://collectiq-api.esxdinero.workers.dev';

// Helper para llamadas a la API
export async function apiCall(route: string, options?: RequestInit) {
  return fetch(`${API_BASE}/${route}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  });
}