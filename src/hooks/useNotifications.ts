import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';

export interface UserNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  created_at: string;
}

export function useNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch notifications
  const { data: notifications = [], isLoading } = useQuery<UserNotification[]>({
    queryKey: ['user-notifications', user?.id],
    enabled: !!user?.id,
    staleTime: 1000 * 30, // 30s
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_notifications' as never)
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as unknown as UserNotification[];
    },
  });

  // Real-time: push new notifications without polling
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'user_notifications', filter: `user_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['user-notifications', user.id] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, queryClient]);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Mark one as read
  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('user_notifications' as never)
        .update({ read: true } as never)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user-notifications', user?.id] }),
  });

  // Mark all as read
  const markAllRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('user_notifications' as never)
        .update({ read: true } as never)
        .eq('user_id', user!.id)
        .eq('read', false);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user-notifications', user?.id] }),
  });

  return { notifications, unreadCount, isLoading, markRead, markAllRead };
}
