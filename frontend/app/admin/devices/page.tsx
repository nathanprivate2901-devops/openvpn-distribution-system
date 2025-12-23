'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MonitorIcon, LaptopIcon, TabletIcon, SmartphoneIcon } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface Device {
  id: number;
  name: string;
  device_type: 'desktop' | 'laptop' | 'mobile' | 'tablet';
  last_connected: string | null;
  is_active: boolean;
  last_ip: string | null;
  device_id: string;
  user_id: number;
  user_email: string;
  user_name: string;
  created_at: string;
}

export default function AdminDevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const { toast } = useToast();

  const deviceIcons = {
    desktop: MonitorIcon,
    laptop: LaptopIcon,
    tablet: TabletIcon,
    mobile: SmartphoneIcon,
  };

  const loadDevices = async (currentPage: number = 1) => {
    setIsLoading(true);
    try {
      const response = await api.admin.getAllDevices(currentPage, 20);
      // Axios wraps the backend response in response.data
      // Backend sends: { success, data: { devices, pagination, totalPages } }
      // So we access: response.data.data.devices
      setDevices(response.data.data.devices || []);
      setTotalPages(response.data.data.totalPages || 1);
    } catch (error) {
      console.error('Load devices error:', error);
      toast({
        title: "Error",
        description: "Failed to load devices",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDevices(page);
  }, [page]);

  const handleToggleActive = async (deviceId: number, currentState: boolean) => {
    try {
      await api.devices.updateDevice(deviceId, { is_active: !currentState });
      toast({
        title: "Success",
        description: `Device ${!currentState ? 'activated' : 'deactivated'} successfully`,
      });
      loadDevices(page);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update device",
        variant: "destructive",
      });
    }
  };

  const handleDeleteDevice = async (deviceId: number) => {
    if (!confirm('Are you sure you want to delete this device? This action cannot be undone.')) {
      return;
    }

    try {
      await api.devices.deleteDevice(deviceId);
      toast({
        title: "Success",
        description: "Device deleted successfully",
      });
      loadDevices(page);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete device",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center p-8">Loading devices...</div>;
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Device Management</h1>
        <div className="text-sm text-gray-500">
          Total Devices: {devices.length}
        </div>
      </div>

      {devices.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-gray-500">No devices found.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {devices.map((device) => {
            const Icon = deviceIcons[device.device_type] || MonitorIcon;
            return (
              <Card key={device.id} className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 flex-1">
                    <Icon className="h-10 w-10 text-gray-600" />
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h3 className="font-semibold text-lg">{device.name}</h3>
                        {device.is_active ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            Inactive
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 capitalize">{device.device_type}</p>
                      <div className="mt-2 grid grid-cols-2 gap-4 text-sm text-gray-500">
                        <div>
                          <span className="font-medium">User:</span> {device.user_name} ({device.user_email})
                        </div>
                        <div>
                          <span className="font-medium">Last Connected:</span>{' '}
                          {device.last_connected
                            ? new Date(device.last_connected).toLocaleString()
                            : 'Never'}
                        </div>
                        {device.last_ip && (
                          <div>
                            <span className="font-medium">Last IP:</span> {device.last_ip}
                          </div>
                        )}
                        <div>
                          <span className="font-medium">Registered:</span>{' '}
                          {new Date(device.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant={device.is_active ? "outline" : "default"}
                      size="sm"
                      onClick={() => handleToggleActive(device.id, device.is_active)}
                    >
                      {device.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteDevice(device.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center space-x-2 mt-6">
          <Button
            variant="outline"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <span className="px-4 py-2">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            disabled={page === totalPages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
