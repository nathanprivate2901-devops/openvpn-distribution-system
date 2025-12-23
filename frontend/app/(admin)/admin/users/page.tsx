'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Edit, Trash2, Loader2, CheckCircle, XCircle, KeyRound } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [verifiedFilter, setVerifiedFilter] = useState('all');
  const [editUser, setEditUser] = useState<any>(null);
  const [deleteUserId, setDeleteUserId] = useState<number | null>(null);

  const { data: usersData, isLoading } = useQuery({
    queryKey: ['admin-users', page, search, roleFilter, verifiedFilter],
    queryFn: async () => {
      // Convert 'all' sentinel values to empty strings for API
      const role = roleFilter === 'all' ? '' : roleFilter;
      const verified = verifiedFilter === 'all' ? '' : verifiedFilter;
      const response = await api.admin.getAllUsers(page, 20, search, role, verified);
      return response.data.data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: number; updates: any }) => {
      const response = await api.admin.updateUser(data.id, data.updates);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('User updated successfully');
      setEditUser(null);
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || 'Failed to update user';
      toast.error(errorMessage);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await api.admin.deleteUser(id, false);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('User deleted successfully');
      setDeleteUserId(null);
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || 'Failed to delete user';
      toast.error(errorMessage);
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await api.admin.resetUserPassword(id);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Password reset email sent successfully');
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || 'Failed to send password reset email';
      toast.error(errorMessage);
    },
  });

  const users = usersData?.items || [];
  const pagination = usersData?.pagination;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
          <p className="mt-4 text-muted-foreground">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">User Management</h1>
        <p className="text-muted-foreground">Manage system users and their roles</p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search email or username..."
                  className="pl-10"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={roleFilter} onValueChange={(value) => {
                setRoleFilter(value);
                setPage(1);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="All roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All roles</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Email Status</Label>
              <Select value={verifiedFilter} onValueChange={(value) => {
                setVerifiedFilter(value);
                setPage(1);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="true">Verified</SelectItem>
                  <SelectItem value="false">Unverified</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Users ({pagination?.total || 0})</CardTitle>
          <CardDescription>
            Showing {((pagination?.page || 1) - 1) * (pagination?.limit || 20) + 1} to{' '}
            {Math.min((pagination?.page || 1) * (pagination?.limit || 20), pagination?.total || 0)} of{' '}
            {pagination?.total || 0} users
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Verified</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user: any) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.username || user.name || '-'}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.email_verified ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(user.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditUser({
                              ...user,
                              username: user.username || user.name || ''
                            });
                          }}
                          title="Edit user"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (confirm(`Send password reset email to ${user.email}?`)) {
                              resetPasswordMutation.mutate(user.id);
                            }
                          }}
                          disabled={resetPasswordMutation.isPending}
                          title="Reset password"
                        >
                          {resetPasswordMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <KeyRound className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => setDeleteUserId(user.id)}
                          title="Delete user"
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
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <Button
                variant="outline"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => setPage(page + 1)}
                disabled={page === pagination.totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={editUser !== null} onOpenChange={() => setEditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information and permissions
            </DialogDescription>
          </DialogHeader>
          {editUser && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Username</Label>
                <Input
                  value={editUser.username || ''}
                  onChange={(e) => setEditUser({ ...editUser, username: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="text"
                  value={editUser.email}
                  onChange={(e) => setEditUser({ ...editUser, email: e.target.value })}
                  placeholder="user@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={editUser.role}
                  onValueChange={(value) => setEditUser({ ...editUser, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Email Verified</Label>
                <Select
                  value={editUser.email_verified ? 'true' : 'false'}
                  onValueChange={(value) => setEditUser({ ...editUser, email_verified: value === 'true' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Verified</SelectItem>
                    <SelectItem value="false">Not Verified</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editUser) {
                  updateMutation.mutate({
                    id: editUser.id,
                    updates: {
                      username: editUser.username,
                      email: editUser.email,
                      role: editUser.role,
                      email_verified: editUser.email_verified,
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
      <Dialog open={deleteUserId !== null} onOpenChange={() => setDeleteUserId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this user? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteUserId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteUserId && deleteMutation.mutate(deleteUserId)}
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
