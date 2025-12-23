'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit, Trash2, Loader2, TrendingUp } from 'lucide-react';
import { api } from '@/lib/api';
import { getPriorityColor } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const policySchema = z.object({
  policy_name: z.string().min(3, 'Policy name must be at least 3 characters'),
  max_download_speed: z.number().min(1, 'Download speed must be at least 1 Mbps'),
  max_upload_speed: z.number().min(1, 'Upload speed must be at least 1 Mbps'),
  priority: z.enum(['low', 'medium', 'high']),
  description: z.string().optional(),
});

type PolicyFormData = z.infer<typeof policySchema>;

export default function AdminQoSPage() {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [editPolicy, setEditPolicy] = useState<any>(null);
  const [deletePolicyId, setDeletePolicyId] = useState<number | null>(null);

  const { data: policiesData, isLoading } = useQuery({
    queryKey: ['qos-policies'],
    queryFn: async () => {
      const response = await api.qos.getAllPolicies();
      return response.data.data;
    },
  });

  const form = useForm<PolicyFormData>({
    resolver: zodResolver(policySchema),
    defaultValues: {
      policy_name: '',
      max_download_speed: 10,
      max_upload_speed: 5,
      priority: 'medium',
      description: '',
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: PolicyFormData) => {
      const response = await api.qos.createPolicy(data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qos-policies'] });
      toast.success('QoS policy created successfully');
      setIsCreating(false);
      form.reset();
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || 'Failed to create policy';
      toast.error(errorMessage);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: number; updates: Partial<PolicyFormData> }) => {
      const response = await api.qos.updatePolicy(data.id, data.updates);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qos-policies'] });
      toast.success('QoS policy updated successfully');
      setEditPolicy(null);
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || 'Failed to update policy';
      toast.error(errorMessage);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await api.qos.deletePolicy(id);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qos-policies'] });
      toast.success('QoS policy deleted successfully');
      setDeletePolicyId(null);
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || 'Failed to delete policy';
      toast.error(errorMessage);
    },
  });

  const policies = policiesData?.policies || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-muted-foreground">Loading QoS policies...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">QoS Policies</h1>
          <p className="text-muted-foreground">Manage Quality of Service policies</p>
        </div>
        <Button onClick={() => setIsCreating(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Policy
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Policies ({policies.length})</CardTitle>
          <CardDescription>Configure bandwidth limits and priorities</CardDescription>
        </CardHeader>
        <CardContent>
          {policies.length === 0 ? (
            <div className="text-center py-12">
              <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No policies yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first QoS policy to manage bandwidth
              </p>
              <Button onClick={() => setIsCreating(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Policy
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Policy Name</TableHead>
                    <TableHead>Download (Mbps)</TableHead>
                    <TableHead>Upload (Mbps)</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {policies.map((policy: any) => (
                    <TableRow key={policy.id}>
                      <TableCell className="font-medium">{policy.policy_name}</TableCell>
                      <TableCell>{policy.max_download_speed}</TableCell>
                      <TableCell>{policy.max_upload_speed}</TableCell>
                      <TableCell>
                        <Badge className={getPriorityColor(policy.priority)}>
                          {policy.priority}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {policy.description || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditPolicy(policy)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setDeletePolicyId(policy.id)}
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

      {/* Create Policy Dialog */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create QoS Policy</DialogTitle>
            <DialogDescription>
              Define a new Quality of Service policy with bandwidth limits
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="policy_name">Policy Name</Label>
              <Input
                id="policy_name"
                {...form.register('policy_name')}
                placeholder="e.g., Premium, Standard, Basic"
              />
              {form.formState.errors.policy_name && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.policy_name.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="max_download_speed">Download Speed (Mbps)</Label>
                <Input
                  id="max_download_speed"
                  type="number"
                  {...form.register('max_download_speed', { valueAsNumber: true })}
                />
                {form.formState.errors.max_download_speed && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.max_download_speed.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="max_upload_speed">Upload Speed (Mbps)</Label>
                <Input
                  id="max_upload_speed"
                  type="number"
                  {...form.register('max_upload_speed', { valueAsNumber: true })}
                />
                {form.formState.errors.max_upload_speed && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.max_upload_speed.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={form.watch('priority')}
                onValueChange={(value: any) => form.setValue('priority', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                {...form.register('description')}
                placeholder="Brief description of this policy"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreating(false);
                  form.reset();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Policy'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Policy Dialog */}
      <Dialog open={editPolicy !== null} onOpenChange={() => setEditPolicy(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit QoS Policy</DialogTitle>
            <DialogDescription>Update policy settings</DialogDescription>
          </DialogHeader>
          {editPolicy && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Policy Name</Label>
                <Input
                  value={editPolicy.policy_name}
                  onChange={(e) => setEditPolicy({ ...editPolicy, policy_name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Download Speed (Mbps)</Label>
                  <Input
                    type="number"
                    value={editPolicy.max_download_speed}
                    onChange={(e) => setEditPolicy({ ...editPolicy, max_download_speed: Number(e.target.value) })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Upload Speed (Mbps)</Label>
                  <Input
                    type="number"
                    value={editPolicy.max_upload_speed}
                    onChange={(e) => setEditPolicy({ ...editPolicy, max_upload_speed: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={editPolicy.priority}
                  onValueChange={(value) => setEditPolicy({ ...editPolicy, priority: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={editPolicy.description || ''}
                  onChange={(e) => setEditPolicy({ ...editPolicy, description: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPolicy(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editPolicy) {
                  updateMutation.mutate({
                    id: editPolicy.id,
                    updates: {
                      policy_name: editPolicy.policy_name,
                      max_download_speed: editPolicy.max_download_speed,
                      max_upload_speed: editPolicy.max_upload_speed,
                      priority: editPolicy.priority,
                      description: editPolicy.description,
                    },
                  });
                }
              }}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deletePolicyId !== null} onOpenChange={() => setDeletePolicyId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete QoS Policy</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this policy? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletePolicyId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletePolicyId && deleteMutation.mutate(deletePolicyId)}
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
