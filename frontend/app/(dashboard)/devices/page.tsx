'use client';

import DeviceList from '@/components/devices/DeviceList';

export default function DevicesPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Devices</h1>
        <p className="text-muted-foreground mt-2">
          View devices that have connected to the VPN. Devices are automatically tracked when you connect.
        </p>
      </div>
      
      <DeviceList />
    </div>
  );
}

