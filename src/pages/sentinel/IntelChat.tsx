import { ChatSidebar } from "@/components/sentinel/ChatSidebar";
import { useSearchParams } from "react-router-dom";

export default function IntelChat() {
  const [params] = useSearchParams();
  const country = params.get("country") ?? undefined;
  const sessionId = params.get("session") ?? undefined;

  return (
    <div className="flex h-[calc(100vh-44px)] flex-col bg-[#080c10]">
      <div className="border-b border-[#1a2332] px-6 py-3">
        <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-500">
          SENTINEL · INTELLIGENCE
        </p>
        <h1 className="font-mono text-xl font-bold text-amber-400">Intel Chat</h1>
        <p className="font-mono text-[10px] text-zinc-500">
          RAG · JSON Context · Artificial Intelligence · Real-time event context
        </p>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <ChatSidebar isOpen={true} countryCode={country} initialSessionId={sessionId} />
      </div>
    </div>
  );
}
