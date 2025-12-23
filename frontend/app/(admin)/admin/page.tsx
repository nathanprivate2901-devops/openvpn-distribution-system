'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Server, Shield, Activity, HardDrive, Cpu, Smartphone } from 'lucide-react';
import { api } from '@/lib/api';
import { formatBytes, formatUptime } from '@/lib/utils';

export default function AdminDashboardPage() {
  const { data: statsData, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const response = await api.admin.getStats();
      return response.data.data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-muted-foreground">Loading statistics...</p>
        </div>
      </div>
    );
  }

  const stats = statsData || {};
  const userStats = stats.users || {};
  const configStats = stats.configs || {};
  const deviceStats = stats.devices || {};
  const systemStats = stats.system || {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">System overview and statistics</p>
      </div>

      {/* User Stats */}
      <div>
        <h2 className="text-xl font-semibold mb-4">User Statistics</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{userStats.total || 0}</div>
              <p className="text-xs text-muted-foreground">Registered users</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Verified</CardTitle>
              <Shield className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{userStats.verified || 0}</div>
              <p className="text-xs text-muted-foreground">Email verified</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unverified</CardTitle>
              <Shield className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{userStats.unverified || 0}</div>
              <p className="text-xs text-muted-foreground">Pending verification</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Admins</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{userStats.admins || 0}</div>
              <p className="text-xs text-muted-foreground">Admin users</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Config Stats */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Configuration Statistics</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Configs</CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{configStats.total || 0}</div>
              <p className="text-xs text-muted-foreground">Generated configs</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Configs</CardTitle>
              <Server className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{configStats.active || 0}</div>
              <p className="text-xs text-muted-foreground">Currently active</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Revoked Configs</CardTitle>
              <Server className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{configStats.revoked || 0}</div>
              <p className="text-xs text-muted-foreground">Revoked configs</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Connected Devices Stats */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Connected Devices</h2>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Devices</CardTitle>
            <Smartphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{deviceStats.total || 0}</div>
            <p className="text-xs text-muted-foreground">Devices registered in system</p>
          </CardContent>
        </Card>
      </div>

      {/* System Stats */}
      <div>
        <h2 className="text-xl font-semibold mb-4">System Information</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="h-5 w-5" />
                <span>System Uptime</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatUptime(systemStats.uptime || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Platform: {systemStats.platform || 'Unknown'}
              </p>
              <p className="text-xs text-muted-foreground">
                Node: {systemStats.nodeVersion || 'Unknown'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <HardDrive className="h-5 w-5" />
                <span>Memory Usage</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Used</span>
                  <span className="text-sm font-medium">
                    {formatBytes(systemStats.memory?.used || 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Free</span>
                  <span className="text-sm font-medium">
                    {formatBytes(systemStats.memory?.free || 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Total</span>
                  <span className="text-sm font-medium">
                    {formatBytes(systemStats.memory?.total || 0)}
                  </span>
                </div>
                <div className="mt-4 h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary"
                    style={{
                      width: `${((systemStats.memory?.used || 0) / (systemStats.memory?.total || 1)) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
