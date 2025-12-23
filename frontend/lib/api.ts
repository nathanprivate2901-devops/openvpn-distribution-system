import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { authStorage } from './auth';
import type { ApiResponse, ApiError } from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = authStorage.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiError>) => {
    if (error.response?.status === 401) {
      // Unauthorized - clear auth and redirect to login
      authStorage.clearAuth();
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// API helper functions
export const api = {
  // Auth endpoints
  auth: {
    login: (email: string, password: string) =>
      apiClient.post('/auth/login', { email, password }),

    register: (username: string, email: string, password: string) =>
      apiClient.post('/auth/register', { username, email, password }),

    verifyEmail: (token: string) =>
      apiClient.post('/auth/verify-email', { token }),

    resendVerification: (email: string) =>
      apiClient.post('/auth/resend-verification', { email }),

    getCurrentUser: () =>
      apiClient.get('/auth/me'),

    forgotPassword: (email: string) =>
      apiClient.post('/auth/forgot-password', { email }),

    resetPassword: (token: string, newPassword: string) =>
      apiClient.post('/auth/reset-password', { token, newPassword }),

    verifyResetToken: (token: string) =>
      apiClient.get('/auth/verify-reset-token', { params: { token } }),
  },

  // User endpoints
  user: {
    getProfile: () =>
      apiClient.get('/users/profile'),

    updateProfile: (data: { username?: string; email?: string }) =>
      apiClient.put('/users/profile', data),

    changePassword: (currentPassword: string, newPassword: string) =>
      apiClient.put('/users/password', { oldPassword: currentPassword, newPassword }),

    getConfigs: (page = 1, limit = 10) =>
      apiClient.get('/users/configs', { params: { page, limit } }),

    getDashboard: () =>
      apiClient.get('/users/dashboard'),

    deleteAccount: () =>
      apiClient.delete('/users/account'),
  },

  // OpenVPN endpoints
  vpn: {
    generateConfig: () =>
      apiClient.post('/vpn/generate-config'),

    getConfigs: () =>
      apiClient.get('/vpn/configs'),

    getLatestConfig: () =>
      apiClient.get('/vpn/config/latest'),

    getConfigInfo: (id: number) =>
      apiClient.get(`/vpn/config/${id}/info`),

    downloadConfig: (id: number) =>
      apiClient.get(`/vpn/config/${id}`, { responseType: 'blob' }),

    revokeConfig: (id: number) =>
      apiClient.delete(`/vpn/config/${id}`),

    // New endpoints for OpenVPN Access Server profile download
    getProfileInfo: () =>
      apiClient.get('/vpn/profile/info'),

    downloadProfile: () =>
      apiClient.get('/vpn/profile/download', { responseType: 'blob' }),

    downloadAutologinProfile: (username: string) =>
      apiClient.get(`/vpn/profile/autologin/${username}`, { responseType: 'blob' }),

    generateUserProfile: (userId: number) =>
      apiClient.post(`/vpn/profile/generate/${userId}`),
  },

  // QoS endpoints
  qos: {
    getAllPolicies: () =>
      apiClient.get('/qos/policies'),

    getPolicyById: (id: number) =>
      apiClient.get(`/qos/policies/${id}`),

    getMyPolicy: () =>
      apiClient.get('/qos/my-policy'),

    createPolicy: (data: any) =>
      apiClient.post('/qos/policies', data),

    updatePolicy: (id: number, data: any) =>
      apiClient.put(`/qos/policies/${id}`, data),

    deletePolicy: (id: number) =>
      apiClient.delete(`/qos/policies/${id}`),

    assignPolicy: (userId: number, policyId: number) =>
      apiClient.post('/qos/assign', { userId, policyId }),

    removePolicy: (userId: number) =>
      apiClient.delete(`/qos/assign/${userId}`),

    getPolicyStats: (id: number) =>
      apiClient.get(`/qos/policies/${id}/stats`),
  },

  // Admin endpoints
  admin: {
    getStats: () =>
      apiClient.get('/admin/stats'),

    getAllUsers: (page = 1, limit = 10, search = '', role = '', verified = '') =>
      apiClient.get('/admin/users', { params: { page, limit, search, role, verified } }),

    getUserById: (id: number) =>
      apiClient.get(`/admin/users/${id}`),

    updateUser: (id: number, data: any) =>
      apiClient.put(`/admin/users/${id}`, data),

    deleteUser: (id: number, hard = false) =>
      apiClient.delete(`/admin/users/${id}`, { params: { hard } }),

    resetUserPassword: (id: number) =>
      apiClient.post(`/admin/users/${id}/reset-password`),

    getAllConfigs: (page = 1, limit = 10) =>
      apiClient.get('/admin/configs', { params: { page, limit } }),

    deleteConfig: (id: number) =>
      apiClient.delete(`/admin/configs/${id}`),

    cleanupTokens: () =>
      apiClient.post('/admin/cleanup-tokens'),

    getAllDevices: (page = 1, limit = 20) =>
      apiClient.get('/admin/devices', { params: { page, limit } }),
  },

  // Device endpoints
  devices: {
    getAllDevices: () =>
      apiClient.get('/devices'),

    getDevice: (id: number) =>
      apiClient.get(`/devices/${id}`),

    updateDevice: (id: number, data: any) =>
      apiClient.put(`/devices/${id}`, data),

    deleteDevice: (id: number) =>
      apiClient.delete(`/devices/${id}`),
  },

  // LAN Networks endpoints
  lanNetworks: {
    getSuggestions: () =>
      apiClient.get('/lan-networks/suggestions'),

    getMyNetworks: () =>
      apiClient.get('/lan-networks'),

    getEnabledNetworks: () =>
      apiClient.get('/lan-networks/enabled'),

    getNetworkById: (id: number) =>
      apiClient.get(`/lan-networks/${id}`),

    createNetwork: (data: { network_cidr: string; description?: string }) =>
      apiClient.post('/lan-networks', data),

    updateNetwork: (id: number, data: { network_cidr?: string; description?: string; enabled?: boolean }) =>
      apiClient.put(`/lan-networks/${id}`, data),

    toggleNetwork: (id: number, enabled: boolean) =>
      apiClient.patch(`/lan-networks/${id}/toggle`, { enabled }),

    deleteNetwork: (id: number) =>
      apiClient.delete(`/lan-networks/${id}`),

    getAllNetworks: (page = 1, limit = 50) =>
      apiClient.get('/lan-networks/all', { params: { page, limit } }),
  },

  // Docker endpoints
  docker: {
    listContainers: (all = true) =>
      apiClient.get('/docker/containers', { params: { all } }),

    getOpenVPNContainers: () =>
      apiClient.get('/docker/openvpn-containers'),

    getContainerDetails: (id: string) =>
      apiClient.get(`/docker/containers/${id}`),

    startContainer: (id: string) =>
      apiClient.post(`/docker/containers/${id}/start`),

    stopContainer: (id: string, timeout = 10) =>
      apiClient.post(`/docker/containers/${id}/stop`, null, { params: { timeout } }),

    restartContainer: (id: string, timeout = 10) =>
      apiClient.post(`/docker/containers/${id}/restart`, null, { params: { timeout } }),

    removeContainer: (id: string, force = false, volumes = false) =>
      apiClient.delete(`/docker/containers/${id}`, { params: { force, volumes } }),

    getContainerLogs: (id: string, tail = 100) =>
      apiClient.get(`/docker/containers/${id}/logs`, { params: { tail, timestamps: true } }),

    getContainerStats: (id: string) =>
      apiClient.get(`/docker/containers/${id}/stats`),

    createOpenVPNContainer: (data: any) =>
      apiClient.post('/docker/openvpn/create', data),

    getDockerInfo: () =>
      apiClient.get('/docker/info'),

    listImages: (all = false) =>
      apiClient.get('/docker/images', { params: { all } }),

    pullImage: (imageName: string, tag = 'latest') =>
      apiClient.post('/docker/images/pull', { imageName, tag }),
  },
};

export default api;
