import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Bell, BellDot, CheckCheck, Loader2, MessageSquare, FileCheck2, FileX2, FileText, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useNavigate } from 'react-router-dom';
import { useNotifications, UserNotification } from '@/hooks/useNotifications';


const typeConfig: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  report_approved:  { icon: FileCheck2,  color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  report_sent_back: { icon: FileX2,      color: 'text-amber-500',   bg: 'bg-amber-500/10 border-amber-500/20' },
  report_queried:   { icon: FileX2,      color: 'text-red-500',     bg: 'bg-red-500/10 border-red-500/20' },
  report_submitted: { icon: FileText,    color: 'text-blue-500',    bg: 'bg-blue-500/10 border-blue-500/20' },
  comment_added:    { icon: MessageSquare, color: 'text-purple-500', bg: 'bg-purple-500/10 border-purple-500/20' },
  general:          { icon: Info,        color: 'text-muted-foreground', bg: 'bg-muted border-border' },
};

function NotificationItem({ n, onRead }: { n: UserNotification; onRead: (id: string) => void }) {
  const navigate = useNavigate();
  const cfg = typeConfig[n.type] ?? typeConfig.general;
  const Icon = cfg.icon;

  return (
    <div
      className={`px-4 py-3 cursor-pointer hover:bg-muted/40 transition-colors ${!n.read ? 'bg-muted/20' : ''}`}
      onClick={() => {
        if (!n.read) onRead(n.id);
        if (n.link) navigate(n.link);
      }}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 p-1.5 rounded-md border flex-shrink-0 ${cfg.bg}`}>
          <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`text-xs font-semibold ${!n.read ? 'text-foreground' : 'text-muted-foreground'}`}>
              {n.title}
            </span>
            {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />}
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">{n.body}</p>
          <p className="text-[10px] text-muted-foreground/60 mt-1">
            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
          </p>
        </div>
      </div>
    </div>
  );
}

export function InternalNotificationBell() {
  const { notifications, unreadCount, isLoading, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center gap-1">
      {/* Internal notifications */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative h-8 w-8"
            aria-label={`Activity notifications — ${unreadCount} unread`}
          >
            {unreadCount > 0 ? <BellDot className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-indigo-500 text-[10px] font-bold text-white flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0 shadow-xl border-border" align="end" sideOffset={8}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-indigo-500" />
              <span className="font-semibold text-sm">Activity</span>
              {unreadCount > 0 && (
                <Badge variant="outline" className="text-[10px] bg-indigo-500/10 text-indigo-500 border-indigo-500/30 px-1.5 py-0">
                  {unreadCount} new
                </Badge>
              )}
            </div>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground gap-1"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
              >
                <CheckCheck className="h-3 w-3" />
                Mark all read
              </Button>
            )}
          </div>

          <ScrollArea className="max-h-[420px]">
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-20" />
                No activity yet
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {notifications.map(n => (
                  <NotificationItem key={n.id} n={n} onRead={(id) => markRead.mutate(id)} />
                ))}
              </div>
            )}
          </ScrollArea>

          <Separator />
          <div className="px-4 py-2 text-center">
            <span className="text-[10px] text-muted-foreground">
              Notifications from report approvals and team activity
            </span>
          </div>
        </PopoverContent>
      </Popover>

      {/* Regulatory alerts bell (existing) */}

    </div>
  );
}
