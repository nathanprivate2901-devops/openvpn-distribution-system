'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Network, Plus, Trash2, Edit, Loader2, Info, Power, PowerOff } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
}

interface NetworkSuggestion {
  cidr: string;
  description: string;
}

export default function LanNetworksPage() {
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deleteNetworkId, setDeleteNetworkId] = useState<number | null>(null);
  const [editingNetwork, setEditingNetwork] = useState<LanNetwork | null>(null);
  
  const [formData, setFormData] = useState({
    network_cidr: '',
    description: '',
    useSuggestion: false,
  });

  // Query for user's networks
  const { data: networksData, isLoading } = useQuery({
    queryKey: ['lan-networks'],
    queryFn: async () => {
      const response = await api.lanNetworks.getMyNetworks();
      return response.data.data;
    },
  });

  // Query for network suggestions
  const { data: suggestionsData } = useQuery({
    queryKey: ['lan-network-suggestions'],
    queryFn: async () => {
      const response = await api.lanNetworks.getSuggestions();
      return response.data.data;
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: { network_cidr: string; description?: string }) => {
      const response = await api.lanNetworks.createNetwork(data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lan-networks'] });
      toast.success('LAN network created successfully');
      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || 'Failed to create LAN network';
      toast.error(errorMessage);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await api.lanNetworks.updateNetwork(id, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lan-networks'] });
      toast.success('LAN network updated successfully');
      setIsEditDialogOpen(false);
      setEditingNetwork(null);
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || 'Failed to update LAN network';
      toast.error(errorMessage);
    },
  });

  // Toggle mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: number; enabled: boolean }) => {
      const response = await api.lanNetworks.toggleNetwork(id, enabled);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lan-networks'] });
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
      queryClient.invalidateQueries({ queryKey: ['lan-networks'] });
      toast.success('LAN network deleted successfully');
      setDeleteNetworkId(null);
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || 'Failed to delete LAN network';
      toast.error(errorMessage);
    },
  });

  const resetForm = () => {
    setFormData({
      network_cidr: '',
      description: '',
      useSuggestion: false,
    });
  };

  const handleCreate = () => {
    if (!formData.network_cidr.trim()) {
      toast.error('Please enter a network CIDR');
      return;
    }

    createMutation.mutate({
      network_cidr: formData.network_cidr,
      description: formData.description || undefined,
    });
  };

  const handleEdit = (network: LanNetwork) => {
    setEditingNetwork(network);
    setFormData({
      network_cidr: network.network_cidr,
      description: network.description || '',
      useSuggestion: false,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdate = () => {
    if (!editingNetwork) return;

    updateMutation.mutate({
      id: editingNetwork.id,
      data: {
        network_cidr: formData.network_cidr,
        description: formData.description || undefined,
      },
    });
  };

  const handleToggle = (network: LanNetwork) => {
    toggleMutation.mutate({
      id: network.id,
      enabled: !network.enabled,
    });
  };

  const handleSuggestionSelect = (suggestion: string) => {
    setFormData({ ...formData, network_cidr: suggestion });
  };

  const networks = networksData?.networks || [];
  const suggestions = suggestionsData || [];
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
          <h1 className="text-3xl font-bold">LAN Networks</h1>
          <p className="text-muted-foreground">
            Manage networks accessible through your VPN connection
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Network
        </Button>
      </div>

      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>About LAN Networks</AlertTitle>
        <AlertDescription>
          LAN networks allow you to access specific private networks when connected to the VPN.
          Only enabled networks will be included in your VPN configuration.
          Changes take effect when you generate a new VPN configuration.
        </AlertDescription>
      </Alert>

      {/* Statistics Card */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
        <CardHeader>
          <CardTitle>Network Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-primary rounded-lg">
                <Network className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{networks.length}</p>
                <p className="text-sm text-muted-foreground">Total Networks</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-green-500 rounded-lg">
                <Power className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold">{enabledCount}</p>
                <p className="text-sm text-muted-foreground">Enabled</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-gray-500 rounded-lg">
                <PowerOff className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold">{networks.length - enabledCount}</p>
                <p className="text-sm text-muted-foreground">Disabled</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Networks Table */}
      <Card>
        <CardHeader>
          <CardTitle>Your Networks</CardTitle>
          <CardDescription>
            {networks.length} configured network(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {networks.length === 0 ? (
            <div className="text-center py-12">
              <Network className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No networks configured</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Add your first LAN network to access it through the VPN
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Network
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
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
                            variant="outline"
                            onClick={() => handleEdit(network)}
                          >
                            <Edit className="h-4 w-4" />
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
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Add LAN Network</DialogTitle>
            <DialogDescription>
              Add a new private network to access through your VPN connection.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Network Suggestions */}
            {suggestions.length > 0 && (
              <div className="space-y-2">
                <Label>Common Networks (Quick Select)</Label>
                <Select onValueChange={handleSuggestionSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a common network or enter custom..." />
                  </SelectTrigger>
                  <SelectContent>
                    {suggestions.map((suggestion: NetworkSuggestion, index: number) => (
                      <SelectItem key={index} value={suggestion.cidr}>
                        <span className="font-mono">{suggestion.cidr}</span>
                        <span className="text-muted-foreground ml-2">- {suggestion.description}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="network_cidr">Network CIDR *</Label>
              <Input
                id="network_cidr"
                placeholder="192.168.1.0/24"
                value={formData.network_cidr}
                onChange={(e) => setFormData({ ...formData, network_cidr: e.target.value })}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Enter the network in CIDR notation (e.g., 192.168.1.0/24)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Home Network, Office Network, etc."
                value={formData.description}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateDialogOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Network
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit LAN Network</DialogTitle>
            <DialogDescription>
              Update network CIDR or description.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit_network_cidr">Network CIDR *</Label>
              <Input
                id="edit_network_cidr"
                placeholder="192.168.1.0/24"
                value={formData.network_cidr}
                onChange={(e) => setFormData({ ...formData, network_cidr: e.target.value })}
                className="font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_description">Description</Label>
              <Textarea
                id="edit_description"
                placeholder="Home Network, Office Network, etc."
                value={formData.description}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false);
                setEditingNetwork(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Network'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteNetworkId !== null} onOpenChange={() => setDeleteNetworkId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete LAN Network</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this network? This action cannot be undone.
              The network will be removed from future VPN configurations.
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
