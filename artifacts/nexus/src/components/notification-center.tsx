import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import {
  Bell, Check, CheckCheck, Clock, ExternalLink, Filter,
  GitCompareArrows, Lock, RefreshCw, ShieldAlert, Sparkles,
} from 'lucide-react';
import {
  listNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  triggerOperationalAlertsCheck,
} from '@/data/nexus-data';
import type { NexusNotification, NotificationType } from '@/types/nexus';
import { useAuth } from '@/auth/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function getTypeDetails(type: NotificationType): { label: string; tone: string; icon: typeof Bell } {
  switch (type) {
    case 'coordination_available':
      return { label: 'Review Queue', tone: 'bg-[#E8F0E9] text-[#245842] border-[#CFE3D5]', icon: GitCompareArrows };
    case 'coordination_reviewed':
      return { label: 'Review Outcome', tone: 'bg-[#EAF2F0] text-[#265349] border-[#CDE0DC]', icon: Sparkles };
    case 'access_updated':
      return { label: 'Account Access', tone: 'bg-[#F5F3EC] text-[#55606E] border-[#E5E1D8]', icon: Lock };
    case 'operational_alert':
      return { label: 'System Alert', tone: 'bg-[#FDF8EC] text-[#825B1D] border-[#EFE1C3]', icon: ShieldAlert };
    default:
      return { label: 'Update', tone: 'bg-[#F5F3EC] text-[#55606E] border-[#E5E1D8]', icon: Bell };
  }
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [, setLocation] = useLocation();
  const { mode, profile } = useAuth();
  const qc = useQueryClient();

  // Initial trigger for operational alerts check (idempotent, daily deduplicated)
  useEffect(() => {
    if (mode === 'signed-in') {
      void triggerOperationalAlertsCheck().then(() => {
        void qc.invalidateQueries({ queryKey: ['nexus-unread-count'] });
        void qc.invalidateQueries({ queryKey: ['nexus-notifications'] });
      });
    }
  }, [mode, qc]);

  // Realtime subscription with fallback
  useEffect(() => {
    const client = supabase;
    if (!client || !profile?.id || mode !== 'signed-in') return;
    const channel = client
      .channel(`user-notifications-${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${profile.id}`,
        },
        () => {
          void qc.invalidateQueries({ queryKey: ['nexus-notifications'] });
          void qc.invalidateQueries({ queryKey: ['nexus-unread-count'] });
        },
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [profile?.id, mode, qc]);

  const {
    data: notifications = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['nexus-notifications', unreadOnly],
    queryFn: () => listNotifications({ unreadOnly }),
    refetchInterval: 30000, // Modest 30s fallback polling
  });

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['nexus-unread-count'],
    queryFn: getUnreadNotificationCount,
    refetchInterval: 30000,
  });

  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['nexus-unread-count'] });
      await qc.invalidateQueries({ queryKey: ['nexus-notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['nexus-unread-count'] });
      await qc.invalidateQueries({ queryKey: ['nexus-notifications'] });
    },
  });

  const handleItemClick = useCallback(
    (notification: NexusNotification) => {
      if (!notification.readAt) {
        markReadMutation.mutate(notification.id);
      }
      setOpen(false);
      if (notification.destinationPath) {
        setLocation(notification.destinationPath);
      }
    },
    [markReadMutation, setLocation],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Notifications (${unreadCount} unread)`}
          className="relative grid h-8 w-8 place-items-center rounded-lg border border-[hsl(var(--border))] bg-card text-muted-foreground shadow-2xs transition-colors hover:border-[#376B58]/40 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-[#376B58]/20"
          data-testid="button-notifications-bell"
        >
          <Bell size={15} />
          {unreadCount > 0 && (
            <span
              className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#376B58] px-1 text-[9px] font-bold text-white shadow-xs ring-2 ring-white"
              data-testid="badge-unread-count"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="z-50 w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-card p-0 shadow-lg sm:w-[420px]"
      >
        <div className="flex items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--secondary))] px-4 py-3">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold text-foreground">Notifications</h2>
            {mode === 'demo' ? (
              <span className="rounded-full border border-amber-300 bg-amber-100/70 px-2 py-0.5 text-[8px] font-bold tracking-wide text-amber-800">
                SIMULATED
              </span>
            ) : unreadCount > 0 ? (
              <span className="rounded-full border border-emerald-200 bg-[#E8F0E9] px-2 py-0.5 text-[8px] font-bold text-[#245842]">
                {unreadCount} unread
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setUnreadOnly((prev) => !prev)}
              aria-pressed={unreadOnly}
              className={`rounded-md px-2.5 py-1 text-[9px] font-semibold transition ${
                unreadOnly
                  ? 'bg-[#376B58] text-white shadow-2xs'
                  : 'border border-[hsl(var(--border))] bg-card text-slate-700 hover:bg-slate-50'
              }`}
              data-testid="button-toggle-unread-filter"
            >
              <Filter size={10} className="mr-1 inline" />
              {unreadOnly ? 'Unread only' : 'All'}
            </button>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
                className="rounded-md border border-[hsl(var(--border))] bg-card px-2.5 py-1 text-[9px] font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 disabled:opacity-50"
                title="Mark all as read"
                data-testid="button-mark-all-read"
              >
                <CheckCheck size={11} className="mr-1 inline text-[#376B58]" />
                Mark all read
              </button>
            )}
          </div>
        </div>

        <div className="max-h-[380px] divide-y divide-[hsl(var(--border))]/50 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-3 p-4">
              <div className="h-3 w-32 animate-pulse rounded bg-slate-200" />
              <div className="h-10 animate-pulse rounded bg-slate-100" />
              <div className="h-10 animate-pulse rounded bg-slate-100" />
            </div>
          ) : isError ? (
            <div className="p-6 text-center">
              <p className="text-xs font-semibold text-red-800">Could not load notifications</p>
              <button
                type="button"
                onClick={() => refetch()}
                className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-[hsl(var(--border))] bg-card px-2.5 py-1.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-50"
              >
                <RefreshCw size={11} /> Retry
              </button>
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center" data-testid="notifications-empty-state">
              <div className="mx-auto mb-2 grid h-8 w-8 place-items-center rounded-full bg-[hsl(var(--muted))] text-muted-foreground">
                <Bell size={14} />
              </div>
              <p className="text-xs font-semibold text-foreground">
                {unreadOnly ? 'No unread notifications' : 'No notifications'}
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {unreadOnly
                  ? 'All caught up! Switch to All to see past notices.'
                  : 'System notices and coordination updates will appear here.'}
              </p>
            </div>
          ) : (
            notifications.slice(0, 8).map((notification) => {
              const { label, tone, icon: Icon } = getTypeDetails(notification.type);
              const isUnread = !notification.readAt;
              return (
                <div
                  key={notification.id}
                  className={`group relative flex items-start gap-3 p-3.5 transition ${
                    isUnread
                      ? 'border-l-[3px] border-l-[#376B58] bg-[#F5F8F6]'
                      : 'border-l-[3px] border-l-transparent bg-card hover:bg-[#FAF9F5]'
                  }`}
                  data-testid={`notification-item-${notification.id}`}
                >
                  <button
                    type="button"
                    onClick={() => handleItemClick(notification)}
                    className="min-w-0 flex-1 text-left focus:outline-none"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[8px] font-semibold ${tone}`}>
                        <Icon size={9} />
                        {label}
                      </span>
                      {notification.isSimulated && (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.2 text-[8px] font-bold text-amber-700">
                          SIMULATED
                        </span>
                      )}
                      <span
                        className="ml-auto inline-flex items-center gap-1 font-mono text-[8px] text-muted-foreground"
                        title={new Date(notification.createdAt).toLocaleString()}
                      >
                        <Clock size={8} />
                        {formatRelativeTime(notification.createdAt)}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      {isUnread && (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#376B58]" />
                      )}
                      <div className={`truncate text-[11px] font-semibold ${isUnread ? 'text-[#1E2838]' : 'text-slate-700'}`}>
                        {notification.title}
                      </div>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-muted-foreground">
                      {notification.message}
                    </p>
                  </button>

                  {isUnread && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        markReadMutation.mutate(notification.id);
                      }}
                      className="mt-1 rounded p-1 text-slate-400 opacity-60 transition hover:bg-white hover:text-slate-700 hover:opacity-100 group-hover:opacity-100"
                      title="Mark as read"
                      aria-label="Mark as read"
                      data-testid={`button-mark-read-${notification.id}`}
                    >
                      <Check size={13} />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between border-t border-[hsl(var(--border))] bg-[hsl(var(--secondary))]/60 px-4 py-2.5 text-[10px]">
          <span className="text-muted-foreground">In-app activity log</span>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setLocation('/notifications');
            }}
            className="font-semibold text-primary hover:underline"
            data-testid="link-view-all-notifications"
          >
            View full notifications <ExternalLink size={10} className="ml-0.5 inline" />
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
