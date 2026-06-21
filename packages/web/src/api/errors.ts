import { ApiError } from './client';

/** Error `code` → user-facing Spanish copy. */
const MESSAGES: Record<string, string> = {
  validation_error: 'Revisa los datos ingresados.',
  not_found: 'No encontramos lo que buscas.',
  conflict: 'Esta acción ya no es posible.',
  internal_error: 'Ocurrió un error. Intenta de nuevo.',
};

/** Map any thrown value to a Spanish message for the user. */
export function apiErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return MESSAGES[error.code] ?? error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Ocurrió un error inesperado.';
}

/** Convenience for components: `null` when there is no error. */
export function useApiErrorMessage(error: unknown): string | null {
  return error ? apiErrorMessage(error) : null;
}
