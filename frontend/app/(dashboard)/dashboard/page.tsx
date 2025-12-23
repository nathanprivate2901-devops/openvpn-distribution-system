'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Server, Download, CheckCircle, XCircle, Shield } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate, getPriorityColor } from '@/lib/utils';
import { toast } from 'sonner';
import Link from 'next/link';

export default function DashboardPage() {
  const queryClient = useQueryClient();
  
  const { data: dashboardData, isLoading, refetch: refetchDashboard } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const response = await api.user.getDashboard();
      return response.data.data;
    },
  });

  // QoS feature disabled
  // const { data: qosData } = useQuery({
  //   queryKey: ['my-qos-policy'],
  //   queryFn: async () => {
  //     const response = await api.qos.getMyPolicy();
  //     return response.data.data;
  //   },
  // });

  // Query for VPN profile info from OpenVPN Access Server
  const { data: profileInfo } = useQuery({
    queryKey: ['vpn-profile-info'],
    queryFn: async () => {
      try {
        const response = await api.vpn.getProfileInfo();
        return response.data.data;
      } catch (error) {
        console.error('Error fetching profile info:', error);
        return null;
      }
    },
  });

  const handleGenerateConfig = async () => {
    try {
      const response = await api.vpn.downloadProfile();
      const blob = new Blob([response.data], { type: 'application/x-openvpn-profile' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${profileInfo?.username || 'vpn'}_profile.ovpn`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('VPN profile downloaded successfully from OpenVPN Access Server');
      
      // Give the backend a moment to save to database
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Refresh the dashboard to show the newly saved profile
      await refetchDashboard();
      await queryClient.invalidateQueries({ queryKey: ['vpn-configs'] });
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to download VPN profile';
      toast.error(errorMessage);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const stats = dashboardData?.stats;
  const user = dashboardData?.user;
  const latestConfig = stats?.latest_config;
  // QoS feature disabled
  // const qosPolicy = qosData?.policy;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, {user?.username}!</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Configs</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_configs || 0}</div>
            <p className="text-xs text-muted-foreground">
              VPN configurations generated
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Configs</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.active_configs || 0}</div>
            <p className="text-xs text-muted-foreground">
              Currently active configurations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revoked Configs</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.revoked_configs || 0}</div>
            <p className="text-xs text-muted-foreground">
              Revoked configurations
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Latest Config Card - Full Width */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Download className="h-5 w-5" />
            <span>Latest Configuration</span>
          </CardTitle>
          <CardDescription>Your most recent VPN config</CardDescription>
        </CardHeader>
        <CardContent>
            {latestConfig ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Filename</span>
                  <span className="text-sm truncate max-w-[200px]">{latestConfig.filename}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Created</span>
                  <span className="text-sm">{formatDate(latestConfig.created_at)}</span>
                </div>
                {latestConfig.downloaded_at && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Downloaded</span>
                    <span className="text-sm">{formatDate(latestConfig.downloaded_at)}</span>
                  </div>
                )}
                <Link href="/vpn-configs">
                  <Button className="w-full mt-4">
                    View All Configs
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="text-center py-8">
                <Server className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground mb-4">No configurations yet</p>
                <Button 
                  onClick={handleGenerateConfig}
                  disabled={!profileInfo?.canDownload}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Generate Config
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

      {/* Account Status */}
      <Card>
        <CardHeader>
          <CardTitle>Account Status</CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Email</span>
                <span className="text-sm">{user?.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Username</span>
                <span className="text-sm">{user?.username}</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Role</span>
                <Badge variant={user?.role === 'admin' ? 'default' : 'secondary'}>
                  {user?.role}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Email Verified</span>
                <Badge variant={user?.email_verified ? 'default' : 'destructive'}>
                  {user?.email_verified ? 'Verified' : 'Not Verified'}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
