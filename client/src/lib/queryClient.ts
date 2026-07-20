import { QueryClient, QueryFunction } from "@tanstack/react-query";

let accessToken: string | null = null;
let currentScope: { companyId: string | null; shopId: string | null; branchId: string | null; warehouseId: string | null } = {
  companyId: null,
  shopId: null,
  branchId: null,
  warehouseId: null,
};
let scopeReady = false;

export function setAuthToken(token: string | null) {
  accessToken = token;
}

export function getAuthToken(): string | null {
  return accessToken;
}

export function setGlobalScope(scope: { companyId: string | null; shopId: string | null; branchId: string | null; warehouseId: string | null }) {
  currentScope = scope;
  // Mark scope as ready when we have valid shop and branch
  scopeReady = !!(scope.shopId && scope.branchId);
}

export function getGlobalScope() {
  return currentScope;
}

export function isScopeReady(): boolean {
  return scopeReady;
}

export function setScopeReady(ready: boolean) {
  scopeReady = ready;
}

// Custom error class to preserve backend error details
export class ApiError extends Error {
  status: number;
  code?: string;
  details?: Record<string, unknown>;
  errors?: string[];

  constructor(message: string, status: number, code?: string, details?: Record<string, unknown>, errors?: string[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.errors = errors;
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let errorMessage = res.statusText;
    let errorCode: string | undefined;
    let errorDetails: Record<string, unknown> | undefined;
    let errorsList: string[] | undefined;

    try {
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const errorData = await res.json();
        // Priority: message > error > statusText
        errorMessage = errorData.message || errorData.error || res.statusText;
        errorCode = errorData.code;
        errorDetails = errorData.details;
        // Capture errors array for bulk validation failures
        if (Array.isArray(errorData.errors)) {
          errorsList = errorData.errors;
        }
        
        // Log full error in console for debugging
        console.error("API ERROR:", errorData);
      } else {
        const text = await res.text();
        errorMessage = text || res.statusText;
        console.error("API ERROR:", { status: res.status, message: errorMessage });
      }
    } catch {
      // If parsing fails, use status text
      console.error("API ERROR:", { status: res.status, message: res.statusText });
    }

    throw new ApiError(errorMessage, res.status, errorCode, errorDetails, errorsList);
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    // If there's an errors array, format all errors as a list
    if (error.errors && error.errors.length > 0) {
      return error.errors.join('\n');
    }
    
    let msg = error.message;
    if (error.details) {
      const detailStr = typeof error.details === 'object' ? JSON.stringify(error.details) : String(error.details);
      msg += ` - Details: ${detailStr}`;
    }
    return msg;
  }
  if (error instanceof Error) {
    // Check if message contains JSON (from older error format)
    try {
      const match = error.message.match(/^\d+:\s*(.+)$/);
      if (match) {
        const jsonStr = match[1];
        const parsed = JSON.parse(jsonStr);
        // Check for errors array in parsed response
        if (Array.isArray(parsed.errors) && parsed.errors.length > 0) {
          return parsed.errors.join('\n');
        }
        return parsed.message || parsed.error || error.message;
      }
    } catch {
      // Not JSON, return as-is
    }
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return "Unhandled system error — contact admin";
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers: Record<string, string> = {};
  
  const isFormData = typeof FormData !== "undefined" && data instanceof FormData;

  if (data && !isFormData) {
    headers["Content-Type"] = "application/json";
  }
  
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }
  
  if (currentScope.companyId) {
    headers["X-Company-Id"] = currentScope.companyId;
  }
  if (currentScope.shopId) {
    headers["X-Shop-Id"] = currentScope.shopId;
  }
  if (currentScope.branchId) {
    headers["X-Branch-Id"] = currentScope.branchId;
  }
  if (currentScope.warehouseId) {
    headers["X-Warehouse-Id"] = currentScope.warehouseId;
  }
  
  const res = await fetch(url, {
    method,
    headers,
    body: isFormData ? (data as FormData) : (data !== undefined ? JSON.stringify(data) : undefined),
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const headers: Record<string, string> = {};
    
    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }
    
    if (currentScope.companyId) {
      headers["X-Company-Id"] = currentScope.companyId;
    }
    if (currentScope.shopId) {
      headers["X-Shop-Id"] = currentScope.shopId;
    }
    if (currentScope.branchId) {
      headers["X-Branch-Id"] = currentScope.branchId;
    }
    if (currentScope.warehouseId) {
      headers["X-Warehouse-Id"] = currentScope.warehouseId;
    }
    
    // Only use the first element as the URL - additional elements are for cache key purposes only
    const url = queryKey[0] as string;
    const res = await fetch(url, {
      credentials: "include",
      headers,
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
