const API_BASE = '/api/v1';

export interface ApiResponse<T = any> {
  data: T;
  meta?: {
    requestId?: string;
    total?: number;
    message?: string;
    timestamp?: string;
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('pos_token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Request-Id': crypto.randomUUID(),
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const json: ApiResponse<T> = await response.json().catch(() => ({
    error: {
      code: 'PARSE_ERROR',
      message: 'Failed to parse JSON response from server',
    },
  } as any));

  if (!response.ok) {
    // If token expired or revoked, clear and notify
    if (response.status === 401 && !endpoint.includes('/auth/login')) {
      localStorage.removeItem('pos_token');
      localStorage.removeItem('pos_user');
      window.dispatchEvent(new CustomEvent('auth:expired'));
    }

    const errorMsg = json.error?.message || `Request failed with status ${response.status}`;
    const err = new Error(errorMsg);
    (err as any).code = json.error?.code || 'UNKNOWN_ERROR';
    (err as any).details = json.error?.details;
    throw err;
  }

  return json.data;
}
