'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Download, Trash2, Server, Loader2, ShieldCheck, Info } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function VpnConfigsPage() {
  const queryClient = useQueryClient();
  const [revokeConfigId, setRevokeConfigId] = useState<number | null>(null);

  const { data: configsData, isLoading } = useQuery({
    queryKey: ['vpn-configs'],
    queryFn: async () => {
      const response = await api.vpn.getConfigs();
      return response.data.data;
    },
  });

  // Query for VPN profile info from OpenVPN Access Server
  const { data: profileInfo, isLoading: profileInfoLoading } = useQuery({
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

  const revokeMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await api.vpn.revokeConfig(id);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vpn-configs'] });
      toast.success('Configuration revoked successfully');
      setRevokeConfigId(null);
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || 'Failed to revoke configuration';
      toast.error(errorMessage);
    },
  });

  const handleDownload = async (id: number, filename: string) => {
    try {
      const response = await api.vpn.downloadConfig(id);
      const blob = new Blob([response.data], { type: 'application/x-openvpn-profile' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Configuration downloaded successfully');
      queryClient.invalidateQueries({ queryKey: ['vpn-configs'] });
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to download configuration';
      toast.error(errorMessage);
    }
  };

  const handleDownloadVPNProfile = async () => {
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
      // Refresh the configs list to show the newly saved profile
      queryClient.invalidateQueries({ queryKey: ['vpn-configs'] });
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to download VPN profile';
      toast.error(errorMessage);
    }
  };

  const configs = configsData?.configs || [];
  const activeConfigs = configs.filter((c: any) => !c.revoked_at);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-muted-foreground">Loading configurations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">VPN Configurations</h1>
          <p className="text-muted-foreground">Download and manage your OpenVPN profiles from OpenVPN Access Server</p>
        </div>
      </div>

      {/* OpenVPN Access Server Profile Download */}
      {!profileInfoLoading && profileInfo && (
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-primary rounded-lg">
                  <ShieldCheck className="h-6 w-6 text-primary-foreground" />
                </div>
                <div>
                  <CardTitle>OpenVPN Access Server Profile</CardTitle>
                  <CardDescription>
                    Download your secure VPN profile directly from OpenVPN Access Server
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {profileInfo.canDownload ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="font-normal">
                      <Info className="mr-1 h-3 w-3" />
                      Username: {profileInfo.username}
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={profileInfo.vpnAccountExists ? "default" : "secondary"} className="font-normal">
                      {profileInfo.vpnAccountExists ? "✓ Account Active" : "⚠ Account Pending"}
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="font-normal">
                      {profileInfo.profileType === 'userlogin' ? "🔐 Password Required" : "🔓 Auto-login"}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-start space-x-4 pt-2">
                  <Button
                    onClick={handleDownloadVPNProfile}
                    className="font-medium"
                    size="lg"
                  >
                    <Download className="mr-2 h-5 w-5" />
                    Download VPN Profile
                  </Button>
                  <p className="text-sm text-muted-foreground mt-3">
                    This profile is generated from OpenVPN Access Server and includes all necessary certificates and keys.
                    {profileInfo.requiresPassword && " You'll need to enter your password when connecting."}
                  </p>
                </div>
              </>
            ) : (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Profile Not Available</AlertTitle>
                <AlertDescription>
                  {!profileInfo.emailVerified && "Please verify your email address first. "}
                  {!profileInfo.vpnAccountExists && "Your VPN account is being set up. This may take a few minutes. "}
                  Please contact support if this issue persists.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Your Configurations</CardTitle>
          <CardDescription>
            {configs.length} total configuration(s), {activeConfigs.length} active
          </CardDescription>
        </CardHeader>
        <CardContent>
          {configs.length === 0 ? (
            <div className="text-center py-12">
              <Server className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No configurations yet</h3>
              <p className="text-sm text-muted-foreground">
                Download your VPN profile using the button above to get started
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Filename</TableHead>
                    <TableHead>QoS Policy</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Downloaded</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {configs.map((config: any) => (
                    <TableRow key={config.id}>
                      <TableCell className="font-medium">{config.filename}</TableCell>
                      <TableCell>
                        {config.qos_policy ? (
                          <span className="text-sm">{config.qos_policy.policy_name}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground">None</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(config.created_at)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {config.downloaded_at ? formatDate(config.downloaded_at) : 'Never'}
                      </TableCell>
                      <TableCell>
                        {config.revoked_at ? (
                          <Badge variant="destructive">Revoked</Badge>
                        ) : (
                          <Badge variant="default">Active</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          {!config.revoked_at && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDownload(config.id, config.filename)}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => setRevokeConfigId(config.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Revoke Confirmation Dialog */}
      <Dialog open={revokeConfigId !== null} onOpenChange={() => setRevokeConfigId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke Configuration</DialogTitle>
            <DialogDescription>
              Are you sure you want to revoke this configuration? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeConfigId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => revokeConfigId && revokeMutation.mutate(revokeConfigId)}
              disabled={revokeMutation.isPending}
            >
              {revokeMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Revoking...
                </>
              ) : (
                'Revoke'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
