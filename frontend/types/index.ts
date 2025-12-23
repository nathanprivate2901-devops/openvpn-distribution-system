// User types
export interface User {
  id: number;
  username: string;
  email: string;
  role: 'user' | 'admin';
  email_verified: boolean;
  created_at: string;
  updated_at?: string;
}

// Auth types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    token: string;
    user: User;
  };
}

export interface VerifyEmailRequest {
  token: string;
}

// QoS Policy types
export interface QosPolicy {
  id: number;
  policy_name: string;
  max_download_speed: number;
  max_upload_speed: number;
  priority: 'low' | 'medium' | 'high';
  description?: string;
  created_at: string;
  updated_at?: string;
}

export interface CreateQosPolicyRequest {
  policy_name: string;
  max_download_speed: number;
  max_upload_speed: number;
  priority: 'low' | 'medium' | 'high';
  description?: string;
}

export interface AssignQosPolicyRequest {
  userId: number;
  policyId: number;
}

// VPN Config types
export interface VpnConfig {
  id: number;
  user_id: number;
  filename: string;
  config_content?: string;
  qos_policy_id?: number;
  qos_policy?: QosPolicy;
  downloaded_at?: string;
  revoked_at?: string;
  created_at: string;
}

// Admin types
export interface SystemStats {
  users: {
    total: number;
    verified: number;
    unverified: number;
    admins: number;
  };
  configs: {
    total: number;
    active: number;
    revoked: number;
  };
  policies: {
    total: number;
  };
  system: {
    uptime: number;
    memory: {
      total: number;
      free: number;
      used: number;
    };
    platform: string;
    nodeVersion: string;
  };
}

export interface UserListItem extends User {
  config_count?: number;
  qos_policy?: QosPolicy;
}

export interface PaginatedResponse<T> {
  success: boolean;
  message: string;
  data: {
    items: T[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

// Docker types
export interface DockerContainer {
  Id: string;
  Names: string[];
  Image: string;
  ImageID: string;
  Command: string;
  Created: number;
  Ports: DockerPort[];
  Labels: Record<string, string>;
  State: string;
  Status: string;
  HostConfig: {
    NetworkMode: string;
  };
  NetworkSettings: {
    Networks: Record<string, any>;
  };
  Mounts: DockerMount[];
}

export interface DockerPort {
  IP?: string;
  PrivatePort: number;
  PublicPort?: number;
  Type: string;
}

export interface DockerMount {
  Type: string;
  Source: string;
  Destination: string;
  Mode: string;
  RW: boolean;
  Propagation: string;
}

export interface DockerStats {
  cpu_percent: number;
  memory_usage: number;
  memory_limit: number;
  memory_percent: number;
  network_rx: number;
  network_tx: number;
  block_read: number;
  block_write: number;
}

export interface CreateOpenVPNContainerRequest {
  name: string;
  port?: number;
  volumes?: string[];
  env?: string[];
  image?: string;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

export interface ApiError {
  success: false;
  message: string;
  error?: string;
  errors?: Array<{
    field: string;
    message: string;
  }>;
}

// Profile types
export interface UpdateProfileRequest {
  username?: string;
  email?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

// Dashboard types
export interface UserDashboard {
  user: User;
  stats: {
    total_configs: number;
    active_configs: number;
    revoked_configs: number;
    latest_config?: VpnConfig;
  };
  qos_policy?: QosPolicy;
}
