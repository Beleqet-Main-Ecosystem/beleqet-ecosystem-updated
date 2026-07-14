/**
 * Centralized Axios API client for all backend requests.
 * Token is automatically injected from localStorage on each request.
 * Base URL is loaded from environment variables (never hardcoded).
 */
import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

const apiClient: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor: attach JWT access token
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token');
    config.headers = config.headers || {};
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (typeof window !== 'undefined' && error.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      error.message = 'Session expired or unauthorized. Please log in again.';
    }
    return Promise.reject(error);
  },
);

export default apiClient;
