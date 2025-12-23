'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
  created_at: string;
  updated_at: string;
}

type DeviceIconMap = {
  desktop: typeof MonitorIcon;
  laptop: typeof LaptopIcon;
  tablet: typeof TabletIcon;
  mobile: typeof SmartphoneIcon;
};

export default function DeviceList() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const deviceIcons: DeviceIconMap = {
    desktop: MonitorIcon,
    laptop: LaptopIcon,
    tablet: TabletIcon,
    mobile: SmartphoneIcon,
  };

  const loadDevices = async () => {
    try {
      const response = await api.devices.getAllDevices();
      setDevices(response.data.data || response.data);
    } catch (error) {
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
    loadDevices();
  }, []);

  const handleDeleteDevice = async (deviceId: number) => {
    if (!confirm('Are you sure you want to delete this device?')) {
      return;
    }

    try {
      await api.devices.deleteDevice(deviceId);
      toast({
        title: "Success",
        description: "Device deleted successfully",
      });
      loadDevices();
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
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">My Devices</h2>
      </div>

      {devices.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-gray-500">No devices have connected to the VPN yet.</p>
          <p className="text-sm text-gray-400 mt-2">
            Devices will automatically appear here once you connect to the VPN.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {devices.map((device) => {
            const Icon = deviceIcons[device.device_type] || MonitorIcon;
            return (
              <Card key={device.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-4">
                    <Icon className="h-8 w-8 text-gray-600" />
                    <div>
                      <h3 className="font-semibold">{device.name}</h3>
                      <p className="text-sm text-gray-500 capitalize">
                        {device.device_type}
                      </p>
                      <p className="text-xs text-gray-400">
                        Last connected: {device.last_connected ? new Date(device.last_connected).toLocaleString() : 'Never'}
                      </p>
                      {device.last_ip && (
                        <p className="text-xs text-gray-400">
                          IP: {device.last_ip}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDeleteDevice(device.id)}
                  >
                    Delete
                  </Button>
                </div>
                <div className="mt-4">
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
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
