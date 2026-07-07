import { Outlet, Link, useLocation } from "react-router-dom";
import { Suspense, useState, useEffect } from "react";
import {
  Globe,
  Flag,
  Radio,
  LayoutGrid,
  MessageSquare,
  LogOut,
  UserCircle,
  Shield,
  AlertTriangle,
  Clock,
  Database,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navItems = [
  { path: "/",         icon: Globe,          label: "Global Map",       sub: "LIVE INTELLIGENCE" },
  { path: "/country",  icon: Flag,           label: "Country Intel",    sub: "DRILL-DOWN" },
  { path: "/feed",     icon: Radio,          label: "Live Wire",        sub: "VERIFIED FEED" },
  { path: "/matrix",   icon: LayoutGrid,     label: "Risk Matrix",      sub: "HEAT TABLE" },
  { path: "/chat",     icon: MessageSquare,  label: "Intel Chat",       sub: "AI ANALYST" },
  { path: "/history",  icon: Clock,          label: "Chat History",     sub: "PAST INVESTIGATIONS" },
  { path: "/workflows", icon: LayoutGrid,     label: "Workflow Engine",  sub: "AUTOMATION" },
  { path: "/data-sources", icon: Database,    label: "Data Sources",     sub: "BYOD INGESTION" },
];

function LocalClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const timeString = time.toLocaleTimeString('en-US', { hour12: false });
  const tzParts = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' }).formatToParts(time);
  const tzString = tzParts.find(p => p.type === 'timeZoneName')?.value || '';

  return (
    <span className="font-mono text-[10px] text-amber-400/80 tabular-nums tracking-widest">
      {timeString} {tzString}
    </span>
  );
}

import { supabase } from "@/integrations/supabase/client";

export const SentinelLayout = () => {
  const location = useLocation();
  const [userEmail, setUserEmail] = useState<string>("analyst@sentinel.ops");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) {
        setUserEmail(user.email);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email) {
        setUserEmail(session.user.email);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <SidebarProvider>
      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <Sidebar
        collapsible="icon"
        variant="sidebar"
        className="border-r border-[#1a2332] bg-[#080c10] text-zinc-100"
      >
        {/* Logo */}
        <SidebarHeader className="border-b border-[#1a2332] px-4 pb-3 pt-4">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-amber-500 text-[#080c10]">
              <Shield className="h-4 w-4" strokeWidth={2.5} />
            </div>
            <div className="flex flex-col">
              <span className="font-mono text-xs font-bold tracking-[0.15em] text-amber-400">
                SENTINEL
              </span>
              <span className="text-[9px] uppercase tracking-widest text-zinc-500">
                OPS · INTELLIGENCE PLATFORM
              </span>
            </div>
          </Link>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel className="mt-4 font-mono text-[9px] uppercase tracking-widest text-zinc-600">
              Modules
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.path)}
                      tooltip={item.label}
                      className="group data-[active=true]:bg-amber-500/10 data-[active=true]:text-amber-400 data-[active=true]:border-l-2 data-[active=true]:border-amber-500 hover:bg-[#0d1117] hover:text-zinc-100 rounded-none transition-all"
                    >
                      <Link to={item.path} className="flex items-center gap-3 px-3 py-2">
                        <item.icon className="h-4 w-4 shrink-0" />
                        <div className="flex flex-col min-w-0">
                          <span className="font-mono text-xs font-semibold truncate">
                            {item.label}
                          </span>
                          <span className="text-[9px] tracking-widest text-zinc-600 group-data-[active=true]:text-amber-600 truncate">
                            {item.sub}
                          </span>
                        </div>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* Footer */}
        <SidebarFooter className="border-t border-[#1a2332] p-4">
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-[#0d1117] hover:bg-[#0d1117]"
                  >
                    <UserCircle className="h-5 w-5 text-zinc-500" />
                    <div className="grid flex-1 text-left text-xs leading-tight ml-2">
                      <span className="truncate font-mono font-bold text-zinc-300">
                        {userEmail.split("@")[0]}
                      </span>
                      <span className="truncate font-mono text-[9px] uppercase tracking-widest text-amber-500/70">
                        Lead Analyst
                      </span>
                    </div>
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="top"
                  className="w-56 rounded-none border-[#1a2332] bg-[#080c10] text-zinc-300"
                >
                  <DropdownMenuItem
                    onClick={async () => {
                      await supabase.auth.signOut();
                    }}
                    className="cursor-pointer text-red-400 hover:bg-[#0d1117] focus:text-red-400"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Secure Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      {/* ── Main Content ─────────────────────────────────────────────────────── */}
      <SidebarInset className="flex h-screen flex-col bg-[#080c10] text-zinc-100 overflow-hidden">
        {/* Top bar */}
        <header className="flex h-11 shrink-0 items-center justify-between border-b border-[#1a2332] bg-[#080c10] px-4">
          <div className="flex items-center gap-4">
            <SidebarTrigger className="text-zinc-500 hover:text-zinc-100 md:hidden" />
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">
                SENTINEL · OPS
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Live pulse */}
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
              <span className="font-mono text-[9px] uppercase tracking-widest text-red-400">
                LIVE
              </span>
            </div>
            <LocalClock />
            <AlertTriangle className="h-3.5 w-3.5 text-zinc-600" />
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <Suspense fallback={<div className="flex h-full w-full items-center justify-center">Loading...</div>}>
            <Outlet />
          </Suspense>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
};
