import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function formatDate(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'high':
      return 'text-green-600 bg-green-50 border-green-200';
    case 'medium':
      return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    case 'low':
      return 'text-red-600 bg-red-50 border-red-200';
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200';
  }
}

export function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'running':
      return 'text-green-600 bg-green-50 border-green-200';
    case 'exited':
      return 'text-red-600 bg-red-50 border-red-200';
    case 'paused':
      return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200';
  }
}
