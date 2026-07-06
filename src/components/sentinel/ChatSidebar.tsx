import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2, MessageSquare, X, Download, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import { type SentinelEvent } from "@/hooks/useSentinelRealtime";

const QUICK_PROMPTS = [
  "What is the cause and effect of this event?",
  "What supply chains might this affect?",
  "What are the geopolitical or economic implications?",
  "Are there any secondary or cascading risks?"
];

const GLOBAL_QUICK_PROMPTS = [
  "Summarize the most severe security events today.",
  "Which countries are facing the highest inflation risks?",
  "Are there any major supply chain disruptions globally?",
  "Provide a geopolitical brief on the Middle East."
];

type MessageSource = string | { label: string; url: string };

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: MessageSource[];
  timestamp: Date;
  isInvestigated?: boolean;
};

interface ChatSidebarProps {
  selectedEvent: SentinelEvent | null;
  bulkEvents?: SentinelEvent[] | null;
  onClose?: () => void;
  countryCode?: string;
  onVirtualEventCreated?: (eventId: string, graphData?: any) => void;
  onGraphGenerated?: (graphData: any) => void;
  initialSessionId?: string;
}

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "SENTINEL INTELLIGENCE ONLINE. Ask me about supply chains, regional stability, geopolitical risks, or commodity impacts. I have access to real-time event data and historical risk patterns.",
  timestamp: new Date(),
};

export function ChatSidebar({ selectedEvent, bulkEvents, onClose, countryCode, onVirtualEventCreated, onGraphGenerated, initialSessionId }: ChatSidebarProps) {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId ?? null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [investigating, setInvestigating] = useState(false);
  const [investigatedLocally, setInvestigatedLocally] = useState(false);
  const [investigationPhase, setInvestigationPhase] = useState("🔍 INVESTIGATING DEEPLY (CRAWLING)...");
  const scrollRef = useRef<HTMLDivElement>(null);

  const investigateDeeply = useCallback(async (userPrompt?: string, messageId?: string) => {
    if ((!selectedEvent && !(bulkEvents && bulkEvents.length > 0) && !userPrompt) || investigating) return;
    setInvestigating(true);
    setInvestigationPhase("🔍 INVESTIGATING DEEPLY (CRAWLING)...");
    
    if (messageId) {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isInvestigated: true } : m));
      if (sessionId) {
        (supabase as any).from('sentinel_chat_messages').update({ is_investigated: true }).eq('id', messageId).then();
      }
    }

    const phases = [
      "🔍 INVESTIGATING DEEPLY (CRAWLING)...",
      "⏳ COMPILING RESEARCH DATA...",
      "🛡️ BYPASSING RATE LIMITS...",
      "🔄 CASCADING MODELS...",
      "🧠 BUILDING DETERMINISTIC GRAPH..."
    ];
    let phaseIdx = 0;
    const loadingInterval = setInterval(() => {
      phaseIdx = (phaseIdx + 1) % phases.length;
      setInvestigationPhase(phases[phaseIdx]);
    }, 3500);

    // Always show a user bubble so the user can see what triggered this investigation
    const triggerLabel = userPrompt
      ? userPrompt
      : selectedEvent
        ? `Investigate deeply: ${selectedEvent.headline}`
        : bulkEvents && bulkEvents.length > 0
          ? `Investigate deeply: ${bulkEvents.length} lassoed events`
          : "Investigate deeply";

    setMessages((prev) => [...prev, {
      id: crypto.randomUUID(),
      role: "user",
      content: triggerLabel,
      timestamp: new Date()
    }]);
    
    setMessages((prev) => [...prev, {
      id: crypto.randomUUID(),
      role: "assistant",
      content: `[SYSTEM]: Initiating Deep Research Protocol... Crawling external sources to explicitly map the supply chain graph for this specific query.`,
      timestamp: new Date()
    }]);

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sentinel-deep-research`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ 
            event_id: selectedEvent?.id, 
            user_prompt: userPrompt,
            bulk_events: bulkEvents
          })
        }
      );

      let data;
      try {
        data = await res.json();
      } catch (e) {
        throw new Error(`Deep Research failed: ${res.status} ${res.statusText}`);
      }
      
      if (!res.ok) {
        throw new Error(data.error || `Edge Function Error: ${res.status}`);
      }
      
      if (data.event_id && !selectedEvent && onVirtualEventCreated) {
        onVirtualEventCreated(data.event_id, data.graph);
      }
      
      if (data.graph && onGraphGenerated) {
        onGraphGenerated(data.graph);
      }
      
      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Deep Research Complete. The deterministic graph has been populated. Check the map view.",
          timestamp: new Date()
        }
      ]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `Deep Research failed: ${err.message}`,
          timestamp: new Date()
        }
      ]);
    } finally {
      clearInterval(loadingInterval);
      setInvestigating(false);
      setInvestigatedLocally(true); // Unlock chat immediately
    }
  }, [selectedEvent, bulkEvents, investigating, onVirtualEventCreated]);

  // Load History
  useEffect(() => {
    const loadHistory = async () => {
      setLoading(true);
      try {
        let targetSessionId = initialSessionId;
        
        if (!targetSessionId && selectedEvent) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: sess } = await (supabase as any)
              .from('sentinel_chat_sessions')
              .select('id')
              .eq('event_id', selectedEvent.id)
              .eq('user_id', user.id)
              .order('updated_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            if (sess) targetSessionId = sess.id;
          }
        }

        if (targetSessionId) {
          const { data } = await (supabase as any)
            .from('sentinel_chat_messages')
            .select('*')
            .eq('session_id', targetSessionId)
            .order('created_at', { ascending: true });
          
          if (data && data.length > 0) {
            setSessionId(targetSessionId);
            setMessages(data.map(m => ({
              id: m.id,
              role: m.role as any,
              content: m.content,
              sources: m.sources as any,
              isInvestigated: m.is_investigated,
              timestamp: new Date(m.created_at)
            })));
            return;
          }
        }
        
        // No history found or no target
        setSessionId(null);
        if (bulkEvents && bulkEvents.length > 0) {
          setMessages([{
            id: "welcome",
            role: "assistant",
            content: `I see you've selected a region containing ${bulkEvents.length} events. How would you like me to analyze them? You can ask for a summary of security threats, supply chain impacts, or general risk trends in this area.`,
            timestamp: new Date(),
          }]);
        } else {
          setMessages([WELCOME_MESSAGE]);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    
    loadHistory();
    setInvestigatedLocally(false);
  }, [initialSessionId, selectedEvent?.id, bulkEvents]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const exportBrief = useCallback((msg: Message) => {
    let content = `# Sentinel Intelligence Brief\n\n`;
    content += `**Date:** ${msg.timestamp.toLocaleString()}\n\n`;
    content += `${msg.content}\n\n`;
    
    if (msg.sources && msg.sources.length > 0) {
      content += `### Grounding Appendix\n\n`;
      msg.sources.forEach(s => {
        if (typeof s === 'string') {
          content += `- ${s}\n`;
        } else {
          content += `- [${s.label}](${s.url})\n`;
        }
      });
    }

    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sentinel_brief_${Date.now()}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const exportFullThread = useCallback(() => {
    let content = `# Sentinel Intelligence: Full Chat Thread\n\n`;
    content += `**Exported At:** ${new Date().toLocaleString()}\n\n---\n\n`;
    
    messages.forEach(msg => {
      content += `### ${msg.role === 'user' ? 'USER' : 'SENTINEL AI'} [${msg.timestamp.toLocaleString()}]\n\n`;
      content += `${msg.content}\n\n`;
      if (msg.sources && msg.sources.length > 0) {
        content += `**Sources Used:**\n`;
        msg.sources.forEach(s => {
          if (typeof s === 'string') {
            content += `- ${s}\n`;
          } else {
            content += `- [${s.label}](${s.url})\n`;
          }
        });
        content += `\n`;
      }
      content += `---\n\n`;
    });

    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `sentinel_full_thread_${Date.now()}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [messages]);

  const sendMessage = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || loading) return;
    setInput("");

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      let currentSessionId = sessionId;
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!currentSessionId && user) {
        const { data: newSession } = await (supabase as any)
          .from('sentinel_chat_sessions')
          .insert({
            user_id: user.id,
            event_id: selectedEvent?.id || null,
            title: text.substring(0, 50) + (text.length > 50 ? "..." : "")
          })
          .select('id')
          .single();
          
        if (newSession) {
          currentSessionId = newSession.id;
          setSessionId(newSession.id);
        }
      }

      if (currentSessionId) {
        await (supabase as any).from('sentinel_chat_messages').insert({
          id: userMsg.id,
          session_id: currentSessionId,
          role: userMsg.role,
          content: userMsg.content,
        });
        await (supabase as any).from('sentinel_chat_sessions').update({ updated_at: new Date().toISOString() }).eq('id', currentSessionId);
      }
      // Build conversation history for multi-turn context (exclude welcome message and limit to last 8 turns)
      const conversationHistory = messages
        .filter(m => m.id !== "welcome")
        .slice(-8)
        .map(m => ({ role: m.role, content: m.content }));

      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sentinel-chat-query`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            query: text,
            country_code: countryCode ?? null,
            event_context: selectedEvent ?? null,
            bulk_events: bulkEvents ?? null,
            conversation_history: conversationHistory,
          })
        }
      );
      
      let data;
      try {
        data = await res.json();
      } catch (e) {
        throw new Error(`Edge Function failed: ${res.status} ${res.statusText}`);
      }
      
      if (!res.ok) {
        throw new Error(data.error || `Edge Function Error: ${res.status}`);
      }

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.answer ?? "No response from intelligence engine.",
        sources: data.sources ?? [],
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      
      if (currentSessionId) {
        await (supabase as any).from('sentinel_chat_messages').insert({
          id: assistantMsg.id,
          session_id: currentSessionId,
          role: assistantMsg.role,
          content: assistantMsg.content,
          sources: assistantMsg.sources,
        });
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `Intelligence engine offline: ${err.message ?? "Unknown error"}`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, countryCode, selectedEvent, messages]);

  return (
    <div className="flex flex-1 flex-col border-l border-[#1a2332] bg-[#080c10] overflow-hidden w-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#1a2332] px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-amber-400" />
          <div>
            <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-500">
              INTEL CHAT
            </p>
            <p className="font-mono text-xs font-semibold text-amber-400">
              AI ANALYST
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={exportFullThread} className="text-zinc-500 hover:text-amber-400 transition-colors" title="Export Full Thread">
            <Download className="h-4 w-4" />
          </button>
          {onClose && (
            <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {selectedEvent && (
          <div className="mb-4 rounded-sm border border-amber-500/30 bg-amber-500/5 p-3">
            <p className="mb-1 font-mono text-[9px] uppercase tracking-widest text-amber-500/70">
              FOCUSED EVENT
            </p>
            <p className="text-xs font-semibold text-zinc-200">{selectedEvent.headline}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="rounded-sm bg-zinc-800/60 px-1.5 py-0.5 font-mono text-[9px] uppercase text-zinc-400">
                {selectedEvent.event_type}
              </span>
              <span className="rounded-sm bg-zinc-800/60 px-1.5 py-0.5 font-mono text-[9px] uppercase text-zinc-400">
                SEV {selectedEvent.severity}/10
              </span>
            </div>
            
            {/* Quick Prompts */}
            {(selectedEvent.ai_analysis?.deep_researched || investigatedLocally) && (
              <div className="mt-3 space-y-1.5 border-t border-amber-500/20 pt-3">
                <p className="mb-2 font-mono text-[9px] uppercase tracking-widest text-amber-500/50">
                  QUICK ANALYSIS PROMPTS
                </p>
                {QUICK_PROMPTS.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => sendMessage(prompt)}
                    className="block w-full rounded-sm border border-[#1a2332] bg-[#0d1117] px-2.5 py-1.5 text-left text-[10px] text-zinc-400 transition-colors hover:border-amber-500/40 hover:text-amber-400"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {!selectedEvent && messages.length <= 2 && (
          <div className="mb-4 rounded-sm border border-amber-500/20 bg-[#0d1117] p-3">
            <p className="mb-2 font-mono text-[9px] uppercase tracking-widest text-amber-500/50">
              GLOBAL ANALYSIS PROMPTS
            </p>
            <div className="space-y-1.5">
              {GLOBAL_QUICK_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => sendMessage(prompt)}
                  className="block w-full rounded-sm border border-[#1a2332] bg-[#121822] px-2.5 py-1.5 text-left text-[10px] text-zinc-400 transition-colors hover:border-amber-500/40 hover:text-amber-400"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-sm px-3 py-2.5 ${
                msg.role === "user"
                  ? "bg-amber-500/20 border border-amber-500/30 text-zinc-100"
                  : "bg-[#0d1117] border border-[#1a2332] text-zinc-300"
              }`}
            >
              {msg.role === "assistant" && (
                <p className="mb-2 font-mono text-[8px] uppercase tracking-widest text-amber-500/60">
                  SENTINEL · AI
                </p>
              )}
              <div className="text-xs leading-relaxed space-y-2">
                <ReactMarkdown
                  components={{
                    p: ({ node, ...props }) => <p className="m-0" {...props} />,
                    ul: ({ node, ...props }) => <ul className="list-disc pl-4 my-1" {...props} />,
                    ol: ({ node, ...props }) => <ol className="list-decimal pl-4 my-1" {...props} />,
                    li: ({ node, ...props }) => <li className="my-0.5" {...props} />,
                    strong: ({ node, ...props }) => <strong className="font-semibold text-amber-500/90" {...props} />
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              </div>
              
              {msg.role === "user" && !selectedEvent && !msg.isInvestigated && (
                <div className="mt-3 border-t border-amber-500/20 pt-2">
                  <button
                    onClick={() => investigateDeeply(msg.content, msg.id)}
                    disabled={investigating}
                    className="flex w-full items-center justify-center gap-1.5 rounded-sm border border-red-500/40 bg-red-500/10 px-2 py-1.5 text-[10px] font-semibold tracking-wide text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50"
                  >
                    {investigating ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Search className="h-3 w-3" />
                    )}
                    INVESTIGATE DEEPLY (MAP GRAPH)
                  </button>
                </div>
              )}
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-4 border-t border-zinc-800/50 pt-3">
                  <p className="mb-2 font-mono text-[9px] uppercase tracking-widest text-amber-500/50">
                    INTELLIGENCE GROUNDING
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {msg.sources.map((s, i) => {
                      if (typeof s === 'string') {
                        return (
                          <span
                            key={i}
                            className="rounded-sm border border-zinc-700/50 bg-zinc-800/40 px-2 py-1 font-mono text-[10px] text-zinc-400 w-fit"
                          >
                            {s}
                          </span>
                        );
                      }
                      return (
                        <a
                          key={i}
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 rounded-sm border border-blue-900/30 bg-blue-900/10 px-2 py-1 font-mono text-[10px] text-blue-400 hover:bg-blue-900/20 hover:text-blue-300 w-fit transition-colors"
                        >
                          <span className="truncate max-w-[200px]">{s.label}</span>
                          <span className="opacity-50">↗</span>
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
              {msg.role === "assistant" && (
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={() => exportBrief(msg)}
                    className="flex items-center gap-1.5 rounded-sm bg-zinc-800/50 px-2 py-1 text-[9px] font-mono text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 transition-colors border border-zinc-700/50"
                  >
                    <Download className="h-3 w-3" />
                    EXPORT BRIEF
                  </button>
                </div>
              )}
              <p className="mt-1.5 font-mono text-[8px] text-zinc-600">
                {msg.timestamp.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-sm border border-[#1a2332] bg-[#0d1117] px-4 py-3">
              <div className="flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin text-amber-400" />
                <span className="font-mono text-[9px] uppercase tracking-widest text-amber-400/60">
                  PROCESSING INTELLIGENCE…
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input or Research Gateway */}
      <div className="border-t border-[#1a2332] p-4">
        {((selectedEvent && !selectedEvent.ai_analysis?.deep_researched) || (bulkEvents && bulkEvents.length > 0)) && !investigatedLocally ? (
          <div className="rounded-sm border border-amber-500/30 bg-amber-500/10 p-3 text-center">
            <p className="mb-3 font-mono text-[10px] text-amber-400/90 leading-relaxed">
              {bulkEvents && bulkEvents.length > 0 
                ? `This bulk selection of ${bulkEvents.length} events requires deep context resolution. Please map the aggregate graph to unlock chat.`
                : `This event requires deep context resolution. Please map the graph to unlock chat.`}
            </p>
            <button
              onClick={() => investigateDeeply(bulkEvents && bulkEvents.length > 0 ? `Map the aggregate supply chain and geopolitical impact for these ${bulkEvents.length} lassoed events.` : undefined)}
              disabled={investigating}
              className="flex w-full items-center justify-center gap-2 rounded-sm bg-amber-500 px-3 py-2 text-[10px] font-bold text-black transition-colors hover:bg-amber-400 disabled:opacity-50"
            >
              {investigating ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {investigationPhase}
                </>
              ) : (
                <>
                  <Search className="h-3.5 w-3.5" />
                  INVESTIGATE DEEPLY (MAP GRAPH)
                </>
              )}
            </button>
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Ask about supply chains, stability…"
                disabled={loading}
                className="flex-1 rounded-sm border border-[#1a2332] bg-[#0d1117] px-3 py-2 font-mono text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-amber-500/50 focus:outline-none disabled:opacity-50"
              />
              <button
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
                className="flex h-9 w-9 items-center justify-center rounded-sm border border-amber-500/30 bg-amber-500/10 text-amber-400 transition-colors hover:bg-amber-500/20 disabled:opacity-40"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="mt-1.5 font-mono text-[8px] uppercase tracking-widest text-zinc-600">
              RAG · JSON CONTEXT · LLAMA 3.3 70B
            </p>
          </>
        )}
      </div>
    </div>
  );
}
