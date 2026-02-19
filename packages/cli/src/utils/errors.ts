import axios from 'axios';

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export function errorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const data = typeof error.response?.data === 'string' ? error.response.data : JSON.stringify(error.response?.data ?? {});
    return `HTTP ${status ?? 'unknown'}: ${data}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
