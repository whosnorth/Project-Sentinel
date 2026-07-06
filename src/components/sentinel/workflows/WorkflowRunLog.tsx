import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { ChevronDown, ChevronRight, CheckCircle, AlertTriangle, XCircle, SkipForward, RefreshCw } from "lucide-react";

type ActionResult = {
  label: string;
  status: "ok" | "error" | "skipped" | "partial";
  detail: string;
};

type WorkflowRun = {
  id: string;
  workflow_id: string;
  trigger_label: string;
  trigger_event_id: string | null;
  actions_executed: ActionResult[];
  status: "success" | "partial" | "error" | "skipped";
  error_message: string | null;
  executed_at: string;
  sentinel_workflows?: { name: string };
};

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "success": case "ok":
      return <CheckCircle className="h-3 w-3 text-emerald-400" />;
    case "partial":
      return <AlertTriangle className="h-3 w-3 text-amber-400" />;
    case "error":
      return <XCircle className="h-3 w-3 text-red-400" />;
    case "skipped":
      return <SkipForward className="h-3 w-3 text-zinc-500" />;
    default:
      return <CheckCircle className="h-3 w-3 text-zinc-500" />;
  }
}

function statusColor(status: string): string {
  switch (status) {
    case "success": case "ok": return "text-emerald-400";
    case "partial": return "text-amber-400";
    case "error":   return "text-red-400";
    default:        return "text-zinc-500";
  }
}

export function WorkflowRunLog({ workflowId }: { workflowId?: string | null }) {
  const { organizationId } = useAuth();
  const [expandedRun, setExpandedRun] = useState<string | null>(null);

  const { data: runs = [], isLoading, refetch } = useQuery({
    queryKey: ["workflow-runs", organizationId, workflowId],
    enabled: !!organizationId,
    queryFn: async () => {
      let q = (supabase as any)
        .from("sentinel_workflow_runs")
        .select("*, sentinel_workflows(name)")
        .eq("tenant_id", organizationId)
        .order("executed_at", { ascending: false })
        .limit(50);

      if (workflowId) {
        q = q.eq("workflow_id", workflowId);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as WorkflowRun[];
    },
    refetchInterval: 15000,
  });

  return (
    <div className="border-t border-white/10 bg-[#080c10]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">
            RUN HISTORY
          </span>
          {runs.length > 0 && (
            <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 font-mono text-[8px] text-zinc-400">
              {runs.length}
            </span>
          )}
        </div>
        <button
          onClick={() => refetch()}
          className="text-zinc-600 hover:text-zinc-300 transition-colors"
          title="Refresh"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto max-h-48 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-5 rounded bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : runs.length === 0 ? (
          <p className="p-4 font-mono text-[10px] text-zinc-600 text-center">
            No runs yet. Workflows fire automatically when events are ingested.
          </p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                {["TIME", "WORKFLOW", "TRIGGER", "ACTIONS", "STATUS"].map((h) => (
                  <th key={h} className="px-3 py-1.5 text-left font-mono text-[8px] uppercase tracking-widest text-zinc-600">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => {
                const isExpanded = expandedRun === run.id;
                const successCount = run.actions_executed?.filter(a => a.status === "ok").length ?? 0;
                const totalCount   = run.actions_executed?.length ?? 0;
                return (
                  <>
                    <tr
                      key={run.id}
                      className="border-b border-white/5 cursor-pointer hover:bg-white/[0.02] transition-colors"
                      onClick={() => setExpandedRun(isExpanded ? null : run.id)}
                    >
                      <td className="px-3 py-1.5 font-mono text-[9px] text-zinc-500 whitespace-nowrap">
                        {new Date(run.executed_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </td>
                      <td className="px-3 py-1.5 font-mono text-[9px] text-zinc-300 max-w-[120px] truncate">
                        {run.sentinel_workflows?.name ?? "—"}
                      </td>
                      <td className="px-3 py-1.5 font-mono text-[9px] text-zinc-400 max-w-[140px] truncate">
                        {run.trigger_label ?? "—"}
                      </td>
                      <td className="px-3 py-1.5 font-mono text-[9px] text-zinc-400">
                        {totalCount > 0 ? `${successCount}/${totalCount}` : "—"}
                      </td>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-1.5">
                          <StatusIcon status={run.status} />
                          <span className={`font-mono text-[9px] uppercase ${statusColor(run.status)}`}>
                            {run.status}
                          </span>
                          {isExpanded
                            ? <ChevronDown className="h-2.5 w-2.5 text-zinc-600 ml-auto" />
                            : <ChevronRight className="h-2.5 w-2.5 text-zinc-600 ml-auto" />
                          }
                        </div>
                      </td>
                    </tr>

                    {/* Expanded action log */}
                    {isExpanded && run.actions_executed && run.actions_executed.length > 0 && (
                      <tr key={`${run.id}-expanded`} className="border-b border-white/5 bg-white/[0.015]">
                        <td colSpan={5} className="px-6 py-3">
                          <div className="space-y-1.5">
                            {run.actions_executed.map((action, i) => (
                              <div key={i} className="flex items-start gap-2">
                                <StatusIcon status={action.status} />
                                <div>
                                  <span className="font-mono text-[9px] font-bold text-zinc-300">{action.label}</span>
                                  <p className="font-mono text-[8px] text-zinc-600 mt-0.5 leading-relaxed max-w-xl">
                                    {action.detail}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
