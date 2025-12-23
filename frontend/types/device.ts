import { type LucideIcon } from 'lucide-react';

export interface Device {
  id: number;
  name: string;
  device_type: DeviceType;
  last_connected: string | null;
  is_active: boolean;
  last_ip: string | null;
  user_id: number;
  device_id: string;
  created_at: string;
  updated_at: string;
}

export type DeviceType = 'desktop' | 'laptop' | 'mobile' | 'tablet';

export interface DeviceIconMap {
  desktop: LucideIcon;
  laptop: LucideIcon;
  mobile: LucideIcon;
  tablet: LucideIcon;
}

export interface DeviceListResponse {
  success: boolean;
  data: Device[];
}

export interface DeviceResponse {
  success: boolean;
  data: Device;
}

export interface ApiResponse {
  success: boolean;
  message: string;
}