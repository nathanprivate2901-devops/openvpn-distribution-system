'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Network, Trash2, Loader2, Info, Power, PowerOff, ChevronLeft, ChevronRight } from 'lucide-react';
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

interface LanNetwork {
  id: number;
  user_id: number;
  network_cidr: string;
  network_ip: string;
  subnet_mask: string;
  description: string | null;
  enabled: number;
  created_at: string;
  updated_at: string;
  username?: string;
  email?: string;
}

export default function AdminLanNetworksPage() {
  const queryClient = useQueryClient();
  const [deleteNetworkId, setDeleteNetworkId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 50;

  // Query for all networks (admin)
  const { data: networksData, isLoading } = useQuery({
    queryKey: ['admin-lan-networks', currentPage],
    queryFn: async () => {
      const response = await api.lanNetworks.getAllNetworks(currentPage, limit);
      return response.data.data;
    },
  });

  // Toggle mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: number; enabled: boolean }) => {
      const response = await api.lanNetworks.toggleNetwork(id, enabled);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-lan-networks'] });
      toast.success(`LAN network ${variables.enabled ? 'enabled' : 'disabled'} successfully`);
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || 'Failed to toggle LAN network';
      toast.error(errorMessage);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await api.lanNetworks.deleteNetwork(id);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-lan-networks'] });
      toast.success('LAN network deleted successfully');
      setDeleteNetworkId(null);
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || 'Failed to delete LAN network';
      toast.error(errorMessage);
    },
  });

  const handleToggle = (network: LanNetwork) => {
    toggleMutation.mutate({
      id: network.id,
      enabled: !network.enabled,
    });
  };

  const networks = networksData?.networks || [];
  const totalNetworks = networksData?.total || 0;
  const totalPages = networksData?.totalPages || 1;
  const enabledCount = networks.filter((n: LanNetwork) => n.enabled).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-muted-foreground">Loading LAN networks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">All LAN Networks</h1>
          <p className="text-muted-foreground">
            Manage all user LAN networks across the system
          </p>
        </div>
      </div>

      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Admin Access</AlertTitle>
        <AlertDescription>
          You have admin access to view and manage all LAN networks configured by users.
          Use caution when modifying or deleting user networks.
        </AlertDescription>
      </Alert>

      {/* Statistics Card */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
        <CardHeader>
          <CardTitle>Network Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-primary rounded-lg">
                <Network className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalNetworks}</p>
                <p className="text-sm text-muted-foreground">Total Networks</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-green-500 rounded-lg">
                <Power className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold">{enabledCount}</p>
                <p className="text-sm text-muted-foreground">Enabled (This Page)</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-gray-500 rounded-lg">
                <PowerOff className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold">{networks.length - enabledCount}</p>
                <p className="text-sm text-muted-foreground">Disabled (This Page)</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-blue-500 rounded-lg">
                <Info className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalPages}</p>
                <p className="text-sm text-muted-foreground">Total Pages</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Networks Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Networks</CardTitle>
          <CardDescription>
            Page {currentPage} of {totalPages} ({totalNetworks} total network(s))
          </CardDescription>
        </CardHeader>
        <CardContent>
          {networks.length === 0 ? (
            <div className="text-center py-12">
              <Network className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No networks found</h3>
              <p className="text-sm text-muted-foreground">
                No LAN networks have been configured by users yet.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Network CIDR</TableHead>
                      <TableHead>Network IP</TableHead>
                      <TableHead>Subnet Mask</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {networks.map((network: LanNetwork) => (
                      <TableRow key={network.id}>
                        <TableCell className="font-medium">
                          {network.username || 'Unknown'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {network.email || 'N/A'}
                        </TableCell>
                        <TableCell className="font-mono font-medium">
                          {network.network_cidr}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {network.network_ip}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {network.subnet_mask}
                        </TableCell>
                        <TableCell>
                          {network.description || (
                            <span className="text-sm text-muted-foreground italic">No description</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {network.enabled ? (
                            <Badge variant="default" className="bg-green-500">
                              <Power className="mr-1 h-3 w-3" />
                              Enabled
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <PowerOff className="mr-1 h-3 w-3" />
                              Disabled
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDate(network.created_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end space-x-2">
                            <Button
                              size="sm"
                              variant={network.enabled ? "outline" : "default"}
                              onClick={() => handleToggle(network)}
                              disabled={toggleMutation.isPending}
                            >
                              {network.enabled ? (
                                <PowerOff className="h-4 w-4" />
                              ) : (
                                <Power className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => setDeleteNetworkId(network.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {(currentPage - 1) * limit + 1} to {Math.min(currentPage * limit, totalNetworks)} of {totalNetworks} networks
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                    <div className="flex items-center px-3 text-sm">
                      Page {currentPage} of {totalPages}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteNetworkId !== null} onOpenChange={() => setDeleteNetworkId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete LAN Network</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this network? This action cannot be undone.
              The network will be removed from the user&apos;s future VPN configurations.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteNetworkId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteNetworkId && deleteMutation.mutate(deleteNetworkId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
