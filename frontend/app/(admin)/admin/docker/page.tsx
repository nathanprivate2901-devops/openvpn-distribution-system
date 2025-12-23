'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Container, Play, Square, RotateCw, Trash2, Loader2, Info } from 'lucide-react';
import { api } from '@/lib/api';
import { getStatusColor } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function AdminDockerPage() {
  const queryClient = useQueryClient();
  const [selectedContainer, setSelectedContainer] = useState<string | null>(null);
  const [deleteContainerId, setDeleteContainerId] = useState<string | null>(null);

  const { data: containersData, isLoading } = useQuery({
    queryKey: ['docker-containers'],
    queryFn: async () => {
      const response = await api.docker.listContainers(true);
      return response.data.data;
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const { data: containerDetails } = useQuery({
    queryKey: ['docker-container-details', selectedContainer],
    queryFn: async () => {
      if (!selectedContainer) return null;
      const response = await api.docker.getContainerDetails(selectedContainer);
      return response.data.data;
    },
    enabled: !!selectedContainer,
  });

  const startMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.docker.startContainer(id);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['docker-containers'] });
      toast.success('Container started successfully');
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || 'Failed to start container';
      toast.error(errorMessage);
    },
  });

  const stopMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.docker.stopContainer(id);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['docker-containers'] });
      toast.success('Container stopped successfully');
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || 'Failed to stop container';
      toast.error(errorMessage);
    },
  });

  const restartMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.docker.restartContainer(id);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['docker-containers'] });
      toast.success('Container restarted successfully');
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || 'Failed to restart container';
      toast.error(errorMessage);
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.docker.removeContainer(id, true);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['docker-containers'] });
      toast.success('Container removed successfully');
      setDeleteContainerId(null);
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || 'Failed to remove container';
      toast.error(errorMessage);
    },
  });

  const containers = containersData || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-muted-foreground">Loading containers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Docker Management</h1>
        <p className="text-muted-foreground">Manage Docker containers</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Containers ({containers.length})</CardTitle>
          <CardDescription>Monitor and control Docker containers</CardDescription>
        </CardHeader>
        <CardContent>
          {containers.length === 0 ? (
            <div className="text-center py-12">
              <Container className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No containers</h3>
              <p className="text-sm text-muted-foreground">
                No Docker containers found on this system
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Image</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {containers.map((container: any) => (
                    <TableRow key={container.Id}>
                      <TableCell className="font-medium">
                        {container.Names?.[0]?.replace('/', '') || container.Id.substring(0, 12)}
                      </TableCell>
                      <TableCell className="text-sm">{container.Image}</TableCell>
                      <TableCell className="text-sm">{container.Status}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(container.State)}>
                          {container.State}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedContainer(container.Id)}
                          >
                            <Info className="h-4 w-4" />
                          </Button>
                          {container.State === 'running' ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => restartMutation.mutate(container.Id)}
                                disabled={restartMutation.isPending}
                              >
                                <RotateCw className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => stopMutation.mutate(container.Id)}
                                disabled={stopMutation.isPending}
                              >
                                <Square className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => startMutation.mutate(container.Id)}
                              disabled={startMutation.isPending}
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setDeleteContainerId(container.Id)}
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
          )}
        </CardContent>
      </Card>

      {/* Container Details Dialog */}
      <Dialog open={selectedContainer !== null} onOpenChange={() => setSelectedContainer(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Container Details</DialogTitle>
            <DialogDescription>
              Detailed information about the selected container
            </DialogDescription>
          </DialogHeader>
          {containerDetails && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Basic Information</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ID:</span>
                    <span className="font-mono">{containerDetails.Id?.substring(0, 12)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Name:</span>
                    <span>{containerDetails.Name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Image:</span>
                    <span>{containerDetails.Config?.Image}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">State:</span>
                    <Badge className={getStatusColor(containerDetails.State?.Status || '')}>
                      {containerDetails.State?.Status}
                    </Badge>
                  </div>
                </div>
              </div>

              {containerDetails.NetworkSettings?.Ports && (
                <div>
                  <h3 className="font-semibold mb-2">Ports</h3>
                  <div className="space-y-1 text-sm">
                    {Object.entries(containerDetails.NetworkSettings.Ports).map(([port, bindings]: any) => (
                      <div key={port} className="flex justify-between">
                        <span className="text-muted-foreground">{port}</span>
                        <span>
                          {bindings?.[0]
                            ? `${bindings[0].HostIp}:${bindings[0].HostPort}`
                            : 'Not bound'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {containerDetails.Mounts && containerDetails.Mounts.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Mounts</h3>
                  <div className="space-y-1 text-sm">
                    {containerDetails.Mounts.map((mount: any, index: number) => (
                      <div key={index} className="flex justify-between">
                        <span className="text-muted-foreground truncate max-w-[200px]">
                          {mount.Source}
                        </span>
                        <span className="truncate max-w-[200px]">{mount.Destination}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setSelectedContainer(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteContainerId !== null} onOpenChange={() => setDeleteContainerId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Container</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this container? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteContainerId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteContainerId && removeMutation.mutate(deleteContainerId)}
              disabled={removeMutation.isPending}
            >
              {removeMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Removing...
                </>
              ) : (
                'Remove'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
