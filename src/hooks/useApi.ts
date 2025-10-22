import { useState, useEffect, useCallback, useRef } from "react";
import { ApiResponse } from "../types/common";
import { apiClient } from "../services/api";

interface UseApiOptions<T> {
  immediate?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  retry?: number;
  retryDelay?: number;
}

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  execute: (...args: any[]) => Promise<T | null>;
  reset: () => void;
  refetch: () => Promise<T | null>;
}

export function useApi<T>(
  apiCall: (...args: any[]) => Promise<T>,
  dependencies: any[] = [],
  options: UseApiOptions<T> = {},
): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const {
    immediate = false,
    onSuccess,
    onError,
    retry = 0,
    retryDelay = 1000,
  } = options;

  const retryCountRef = useRef(0);
  const dependenciesRef = useRef(dependencies);

  // Update dependencies ref when they change
  useEffect(() => {
    dependenciesRef.current = dependencies;
  }, [dependencies]);

  const execute = useCallback(
    async (...args: any[]): Promise<T | null> => {
      try {
        setLoading(true);
        setError(null);

        const result = await apiCall(...args);
        setData(result);
        onSuccess?.(result);
        retryCountRef.current = 0;
        return result;
      } catch (err) {
        const error = err as Error;
        setError(error);
        onError?.(error);

        // Retry logic
        if (retryCountRef.current < retry) {
          retryCountRef.current++;
          setTimeout(() => {
            execute(...args);
          }, retryDelay * retryCountRef.current);
        }

        return null;
      } finally {
        setLoading(false);
      }
    },
    [apiCall, onSuccess, onError, retry, retryDelay],
  );

  const reset = useCallback(() => {
    setData(null);
    setLoading(false);
    setError(null);
    retryCountRef.current = 0;
  }, []);

  const refetch = useCallback(async () => {
    return execute();
  }, [execute]);

  // Immediate execution
  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [immediate, execute]);

  return {
    data,
    loading,
    error,
    execute,
    reset,
    refetch,
  };
}

// Hook for paginated data
export function usePaginatedApi<T>(
  apiCall: (params: {
    page: number;
    limit: number;
  }) => Promise<ApiResponse<T[]>>,
  initialParams: { page?: number; limit?: number } = {},
  options: UseApiOptions<ApiResponse<T[]>> = {},
) {
  const [data, setData] = useState<T[]>([]);
  const [pagination, setPagination] = useState({
    page: initialParams.page || 1,
    limit: initialParams.limit || 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(
    async (params: { page?: number; limit?: number } = {}) => {
      try {
        setLoading(true);
        setError(null);

        const requestParams = {
          page: params.page || pagination.page,
          limit: params.limit || pagination.limit,
        };

        const response = await apiCall(requestParams);

        if (response.success && response.data) {
          setData(response.data);
          if ("pagination" in response) {
            setPagination(response.pagination as any);
          }
        }
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    },
    [apiCall, pagination.page, pagination.limit],
  );

  const nextPage = useCallback(() => {
    if (pagination.page < pagination.totalPages) {
      execute({ page: pagination.page + 1 });
    }
  }, [execute, pagination.page, pagination.totalPages]);

  const prevPage = useCallback(() => {
    if (pagination.page > 1) {
      execute({ page: pagination.page - 1 });
    }
  }, [execute, pagination.page]);

  const goToPage = useCallback(
    (page: number) => {
      if (page >= 1 && page <= pagination.totalPages) {
        execute({ page });
      }
    },
    [execute, pagination.totalPages],
  );

  const changeLimit = useCallback(
    (limit: number) => {
      execute({ page: 1, limit });
    },
    [execute],
  );

  useEffect(() => {
    execute();
  }, [execute]);

  return {
    data,
    pagination,
    loading,
    error,
    execute,
    nextPage,
    prevPage,
    goToPage,
    changeLimit,
    refresh: () => execute(),
  };
}

// Hook for file uploads
export function useFileUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<Error | null>(null);

  const uploadFile = useCallback(
    async (
      file: File,
      onProgress?: (progress: number) => void,
      additionalData?: Record<string, any>,
    ) => {
      try {
        setUploading(true);
        setError(null);
        setProgress(0);

        const token = localStorage.getItem("atlas2-auth-token");
        const formData = new FormData();
        formData.append("file", file);

        if (additionalData) {
          Object.entries(additionalData).forEach(([key, value]) => {
            formData.append(key, String(value));
          });
        }

        return new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();

          // Progress tracking
          xhr.upload.addEventListener("progress", (event) => {
            if (event.lengthComputable) {
              const percentComplete = (event.loaded / event.total) * 100;
              setProgress(percentComplete);
              onProgress?.(percentComplete);
            }
          });

          // Load complete
          xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const response = JSON.parse(xhr.responseText);
                resolve(response);
              } catch (err) {
                reject(new Error("Invalid response from server"));
              }
            } else {
              try {
                const errorResponse = JSON.parse(xhr.responseText);
                reject(new Error(errorResponse.message || "Upload failed"));
              } catch {
                reject(new Error(`Upload failed with status ${xhr.status}`));
              }
            }
          });

          // Error handling
          xhr.addEventListener("error", () => {
            reject(new Error("Network error during upload"));
          });

          xhr.addEventListener("abort", () => {
            reject(new Error("Upload was cancelled"));
          });

          // Set up request
          xhr.open("POST", `${import.meta.env.VITE_API_BASE_URL}/api/upload`);

          if (token) {
            xhr.setRequestHeader("Authorization", `Bearer ${token}`);
          }

          xhr.timeout = 300000; // 5 minutes
          xhr.send(formData);
        });
      } catch (err) {
        const error = err as Error;
        setError(error);
        throw error;
      } finally {
        setUploading(false);
        setProgress(0);
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setUploading(false);
    setProgress(0);
    setError(null);
  }, []);

  return {
    uploadFile,
    uploading,
    progress,
    error,
    reset,
  };
}

// Hook for WebSocket connections
export function useWebSocket(
  url: string,
  options: {
    onOpen?: (event: Event) => void;
    onMessage?: (event: MessageEvent) => void;
    onError?: (event: Event) => void;
    onClose?: (event: CloseEvent) => void;
    reconnect?: boolean;
    reconnectInterval?: number;
  } = {},
) {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const {
    onOpen,
    onMessage,
    onError,
    onClose,
    reconnect = true,
    reconnectInterval = 3000,
  } = options;

  const connect = useCallback(() => {
    try {
      const token = localStorage.getItem("atlas2-auth-token");
      const wsUrl = token ? `${url}?token=${token}` : url;

      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = (event) => {
        setConnected(true);
        setError(null);
        onOpen?.(event);
      };

      wsRef.current.onmessage = (event) => {
        onMessage?.(event);
      };

      wsRef.current.onerror = (event) => {
        setConnected(false);
        const error = new Error("WebSocket connection error");
        setError(error);
        onError?.(event);
      };

      wsRef.current.onclose = (event) => {
        setConnected(false);
        onClose?.(event);

        // Reconnect logic
        if (reconnect && !event.wasClean) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        }
      };
    } catch (err) {
      const error = err as Error;
      setError(error);
    }
  }, [url, onOpen, onMessage, onError, onClose, reconnect, reconnectInterval]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setConnected(false);
  }, []);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      throw new Error("WebSocket is not connected");
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    connected,
    error,
    sendMessage,
    disconnect,
    reconnect: connect,
  };
}

// Hook for real-time data
export function useRealtimeData<T>(url: string, initialData: T | null = null) {
  const [data, setData] = useState<T | null>(initialData);
  const [connected, setConnected] = useState(false);

  const { sendMessage, connected: wsConnected } = useWebSocket(url, {
    onMessage: (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "data_update") {
          setData(message.data);
        }
      } catch (err) {
        console.error("Failed to parse WebSocket message:", err);
      }
    },
    onOpen: () => setConnected(true),
    onClose: () => setConnected(false),
  });

  const updateData = useCallback(
    (newData: T) => {
      setData(newData);
      if (wsConnected) {
        sendMessage({
          type: "subscribe",
          data: newData,
        });
      }
    },
    [sendMessage, wsConnected],
  );

  return {
    data,
    connected: connected && wsConnected,
    updateData,
  };
}
