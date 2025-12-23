import axios, { AxiosResponse } from 'axios';

export interface Device {
  id: number;
  name: string;
  device_type: string;
  last_connected: string;
  is_active: boolean;
  last_ip: string;
  user_id: number;
  device_id: string;
  created_at: string;
  updated_at: string;
}

export interface DeviceResponse {
  success: boolean;
  data: Device[];
}

export interface SingleDeviceResponse {
  success: boolean;
  data: Device;
}

// Device API endpoints
const deviceApi = {
  getAllDevices: (): Promise<AxiosResponse<DeviceResponse>> =>
    axios.get('/api/devices'),

  getDevice: (id: number): Promise<AxiosResponse<SingleDeviceResponse>> =>
    axios.get(`/api/devices/${id}`),

  updateDevice: (id: number, data: Partial<Device>): Promise<AxiosResponse<SingleDeviceResponse>> =>
    axios.put(`/api/devices/${id}`, data),

  deleteDevice: (id: number): Promise<AxiosResponse<{ success: boolean; message: string }>> =>
    axios.delete(`/api/devices/${id}`),
};

export default deviceApi;