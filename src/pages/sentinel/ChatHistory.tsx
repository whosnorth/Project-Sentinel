import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Clock, MessageSquare, ChevronRight, Globe, Search } from "lucide-react";
import { format } from "date-fns";

type ChatSession = {
  id: string;
  title: string;
  event_id: string | null;
  created_at: string;
  updated_at: string;
};

export default function ChatHistory() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("sentinel_chat_sessions" as any)
        .select("*")
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setSessions(data || []);
    } catch (err) {
      console.error("Failed to load chat history", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredSessions = sessions.filter(s => 
    s.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-44px)] flex-col bg-[#080c10] overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-[#1a2332] px-6 py-4 flex items-center justify-between">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-500">
            SENTINEL · INTELLIGENCE
          </p>
          <h1 className="font-mono text-xl font-bold text-amber-400 flex items-center gap-2">
            <Clock className="h-5 w-5" /> Chat History
          </h1>
          <p className="font-mono text-[10px] text-zinc-500 mt-1">
            Access past investigations and continue research threads.
          </p>
        </div>
        
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search sessions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-sm border border-[#1a2332] bg-[#0d1117] pl-9 pr-3 py-1.5 font-mono text-[11px] text-zinc-300 placeholder:text-zinc-600 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3 opacity-50">
            <div className="h-8 w-8 rounded-full border-2 border-amber-500/30 border-t-amber-500 animate-spin" />
            <p className="font-mono text-xs uppercase tracking-widest text-zinc-500">LOADING HISTORY...</p>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <MessageSquare className="h-12 w-12 text-zinc-700" />
            <p className="font-mono text-xs uppercase tracking-widest text-zinc-500">
              {search ? "No matching sessions found." : "No chat history found."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 max-w-7xl mx-auto">
            {filteredSessions.map((session) => (
              <div 
                key={session.id}
                onClick={() => navigate(`/chat?session=${session.id}`)}
                className="group relative flex cursor-pointer flex-col justify-between rounded-sm border border-[#1a2332] bg-[#0a0e14] p-4 transition-all hover:border-amber-500/40 hover:bg-[#0d1117]"
              >
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="font-mono text-sm font-semibold text-zinc-200 line-clamp-2 leading-tight group-hover:text-amber-400 transition-colors">
                      {session.title}
                    </h3>
                    {session.event_id && (
                      <div className="flex items-center justify-center shrink-0 h-6 w-6 rounded-sm bg-blue-500/10 text-blue-400 tooltip" title="Linked to Map Event">
                        <Globe className="h-3.5 w-3.5" />
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="mt-4 flex items-center justify-between border-t border-[#1a2332] pt-3">
                  <div className="flex flex-col">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-zinc-600">
                      LAST UPDATED
                    </span>
                    <span className="font-mono text-[10px] text-zinc-400">
                      {format(new Date(session.updated_at), "MMM d, yyyy · HH:mm")}
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-amber-400 transition-colors" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
