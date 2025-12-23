'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Shield, LayoutDashboard, Server, User, LogOut, Settings, Users, Container, Smartphone, Network } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/authStore';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function DashboardNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    router.push('/login');
  };

  const userLinks = [
    {
      href: '/dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      href: '/vpn-configs',
      label: 'VPN Configs',
      icon: Server,
    },
    {
      href: '/lan-networks',
      label: 'LAN Networks',
      icon: Network,
    },
    {
      href: '/devices',
      label: 'My Devices',
      icon: Smartphone,
    },
    {
      href: '/profile',
      label: 'Profile',
      icon: User,
    },
  ];

  const adminLinks = [
    {
      href: '/admin',
      label: 'Admin',
      icon: Settings,
    },
    {
      href: '/admin/users',
      label: 'Users',
      icon: Users,
    },
    {
      href: '/admin/devices',
      label: 'All Devices',
      icon: Smartphone,
    },
    {
      href: '/admin/lan-networks',
      label: 'All LAN Networks',
      icon: Network,
    },
    // QoS and Docker features disabled
    // {
    //   href: '/admin/qos',
    //   label: 'QoS Policies',
    //   icon: Server,
    // },
    // {
    //   href: '/admin/docker',
    //   label: 'Docker',
    //   icon: Container,
    // },
  ];

  const links = user?.role === 'admin' ? [...userLinks, ...adminLinks] : userLinks;

  return (
    <nav className="border-b bg-background">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center space-x-8">
            <Link href="/dashboard" className="flex items-center space-x-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <span className="font-semibold text-lg hidden sm:inline">OpenVPN</span>
            </Link>

            <div className="hidden md:flex space-x-1">
              {links.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href ||
                  (link.href !== '/dashboard' && pathname?.startsWith(link.href));

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      'flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-medium">{user?.username}</span>
              <span className="text-xs text-muted-foreground">{user?.email}</span>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Mobile navigation */}
        <div className="md:hidden pb-4 space-y-1">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href ||
              (link.href !== '/dashboard' && pathname?.startsWith(link.href));

            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
