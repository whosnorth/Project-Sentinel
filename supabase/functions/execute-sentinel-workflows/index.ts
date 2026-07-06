// execute-sentinel-workflows — Sentinel Workflow Engine (Live)
//
// Called automatically on every sentinel_events INSERT via pg_net Postgres trigger.
// Also callable manually via HTTP POST for testing ("Run Now").
//
// Responsibilities:
//   1. Load all active workflows for the org that owns the incoming event
//   2. For each workflow, evaluate all trigger nodes against the event
//   3. BFS-traverse the edge graph from matched trigger nodes
//   4. Execute each action node in order:
//        - Send Webhook URL
//        - Alert Sentinel Analysts   (notifies ALL users in org)
//        - Run Deep Research          (invokes sentinel-deep-research)
//        - Generate Intel Report      (invokes sentinel-chat-query, emails via send-digest)
//        - Country Stability Threshold (new trigger — checks CSI score)
//   5. Write a full execution log to sentinel_workflow_runs
//
// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL      = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Trigger evaluation ─────────────────────────────────────────────────────────
async function evaluateTrigger(
  trigger: any,
  event: any,
  supabase: any
): Promise<boolean> {
  const config = trigger.data?.config || {};
  const label  = (trigger.data?.label as string) ?? "";

  switch (label) {
    case "Geospatial Event Detected": {
      const minSev = parseInt(config.severity ?? "8", 10);
      if ((event.severity ?? 0) < minSev) return false;

      // If a geographic radius is configured, check distance
      if (config.lat !== undefined && config.lng !== undefined && config.radius !== undefined) {
        if (event.lat == null || event.lng == null) return false;
        const R = 6371;
        const dLat = (event.lat - config.lat) * Math.PI / 180;
        const dLon = (event.lng - config.lng) * Math.PI / 180;
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos(config.lat * Math.PI / 180) * Math.cos(event.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
        const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        if (dist > parseFloat(config.radius)) return false;
      }
      return true;
    }

    case "Cyber Threat Identified":
      return event.event_type === "security";

    case "Financial Market Anomaly":
      return event.event_type === "economy";

    case "Supply Chain Disruption":
      return ["infrastructure", "trade", "border", "economy", "social"].includes(event.event_type ?? "");

    case "Country Stability Threshold": {
      if (!config.country_code || config.threshold === undefined) return false;
      // Check if CSI score for this country is below threshold
      const { data: scores } = await supabase
        .from("sentinel_risk_scores")
        .select("score")
        .eq("country_code", config.country_code.toUpperCase())
        .order("computed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!scores) return false;
      return (scores.score ?? 100) < parseFloat(config.threshold);
    }

    default:
      // Unknown trigger type — do not fire to avoid false positives
      return false;
  }
}

// ── Action execution ──────────────────────────────────────────────────────────
async function executeAction(
  actionNode: any,
  event: any,
  workflow: any,
  supabase: any
): Promise<{ label: string; status: "ok" | "error" | "skipped"; detail: string }> {
  const label  = (actionNode.data?.label as string) ?? "";
  const config = actionNode.data?.config || {};

  try {
    switch (label) {
      case "Send Webhook URL": {
        if (!config.url) {
          return { label, status: "skipped", detail: "No URL configured" };
        }
        const res = await fetch(config.url, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ event, workflow_id: workflow.id, workflow_name: workflow.name }),
        });
        return { label, status: res.ok ? "ok" : "error", detail: `HTTP ${res.status}` };
      }

      case "Alert Sentinel Analysts": {
        const priority = config.priority || "High";

        // Notify ALL users in the org (not just org_id as a fake user_id)
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id")
          .eq("organization_id", event.organization_id);

        if (!profiles || profiles.length === 0) {
          return { label, status: "skipped", detail: "No users found in org" };
        }

        const notifications = profiles.map((p: any) => ({
          user_id:   p.id,
          type:      "general",
          title:     `[${priority.toUpperCase()}] Workflow: ${workflow.name}`,
          body:      `An event matched your workflow criteria.\n\n• ${event.headline ?? "Unknown event"}\n• Severity: ${event.severity ?? "N/A"}/10\n• Country: ${event.country_code ?? "N/A"}\n• Type: ${event.event_type ?? "N/A"}`,
          link:      `/sentinel?eventId=${event.id}`,
          read:      false,
        }));

        const { error } = await supabase.from("user_notifications").insert(notifications);
        if (error) throw error;
        return { label, status: "ok", detail: `Notified ${profiles.length} analyst(s)` };
      }

      case "Run Deep Research": {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/sentinel-deep-research`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ event_id: event.id })
        });
        if (!res.ok) {
          throw new Error(`Deep Research Failed: ${res.status} ${await res.text()}`);
        }
        return { label, status: "ok", detail: `Deep research triggered for event ${event.id}` };
      }

      case "Generate Intel Report": {
        // 1. Generate the report via sentinel-chat-query
        const res = await fetch(`${SUPABASE_URL}/functions/v1/sentinel-chat-query`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            query: "Generate a concise C-Suite intelligence brief summarizing the cascading supply chain and geopolitical impacts of this event. Include key risk vectors, affected sectors, and recommended mitigation actions.",
            country_code: event.country_code ?? "",
            event_context: event,
            conversation_history: [],
          })
        });
        if (!res.ok) {
          throw new Error(`Chat Query Failed: ${res.status} ${await res.text()}`);
        }
        const chatData = await res.json();

        const reportText = chatData?.answer ?? "Report generation failed.";
        const reportEmail = config.report_email ?? "";

        // 2. Email the report if an address is configured
        let emailDetail = "No email configured";
        if (reportEmail) {
          const { error: emailErr } = await supabase.functions.invoke("send-digest", {
            body: {
              to:      reportEmail,
              subject: `Sentinel Intel Report — ${event.headline ?? event.country_code ?? "Global Alert"}`,
              body:    reportText,
            },
          });
          emailDetail = emailErr ? `Email failed: ${emailErr.message}` : `Emailed to ${reportEmail}`;
        }

        return {
          label,
          status: "ok",
          detail: `${emailDetail}. Report: ${reportText.slice(0, 200)}…`,
        };
      }

      default:
        return { label, status: "skipped", detail: `Unknown action type: ${label}` };
    }
  } catch (err: any) {
    return { label, status: "error", detail: err.message ?? "Unknown error" };
  }
}

// ── BFS edge traversal ────────────────────────────────────────────────────────
// Traverses the full workflow graph from a starting node, executing every
// action node reachable via the edge list (multi-hop chains supported).
async function traverseAndExecute(
  startNodeId: string,
  nodes: any[],
  edges: any[],
  event: any,
  workflow: any,
  supabase: any
): Promise<{ label: string; status: string; detail: string }[]> {
  const results: { label: string; status: string; detail: string }[] = [];
  const visited = new Set<string>([startNodeId]);
  const queue   = edges
    .filter((e: any) => e.source === startNodeId)
    .map((e: any) => e.target);

  while (queue.length > 0) {
    const nodeId   = queue.shift()!;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    const node = nodes.find((n: any) => n.id === nodeId);
    if (!node) continue;

    if (node.type === "actionNode") {
      const result = await executeAction(node, event, workflow, supabase);
      results.push(result);
      console.log(`  Action [${result.label}]: ${result.status} — ${result.detail}`);
    }

    // Enqueue children regardless of node type (to support nested chains)
    const children = edges
      .filter((e: any) => e.source === nodeId)
      .map((e: any) => e.target);
    queue.push(...children);
  }

  return results;
}

// ── Main handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const payload = await req.json();
    const event   = payload.record || payload;

    // Validate — we need at minimum an organization_id to scope workflows
    if (!event || !event.id) {
      return new Response(
        JSON.stringify({ success: true, message: "No valid event in payload" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If org_id is missing, try to infer from country_code (best-effort)
    const orgId = event.organization_id ?? null;
    if (!orgId) {
      console.log(`Skipping workflow check — event ${event.id} has no organization_id`);
      return new Response(
        JSON.stringify({ success: true, message: "Event has no organization_id — skipped" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch all active workflows for this organisation
    const { data: workflows, error: fetchErr } = await supabase
      .from("sentinel_workflows")
      .select("id, name, nodes, edges")
      .eq("tenant_id", orgId)
      .eq("is_active", true);

    if (fetchErr) throw fetchErr;
    if (!workflows || workflows.length === 0) {
      return new Response(
        JSON.stringify({ success: true, executed: 0, message: "No active workflows" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalExecuted = 0;

    for (const workflow of workflows) {
      console.log(`Evaluating workflow: ${workflow.name} (${workflow.id})`);
      const nodes = (workflow.nodes as any[]) || [];
      const edges = (workflow.edges as any[]) || [];
      const triggerNodes = nodes.filter((n: any) => n.type === "triggerNode");

      for (const trigger of triggerNodes) {
        const passed = await evaluateTrigger(trigger, event, supabase);
        if (!passed) continue;

        console.log(`  Trigger matched: ${trigger.data?.label}`);

        // BFS traverse from this trigger and execute all downstream actions
        const actionResults = await traverseAndExecute(trigger.id, nodes, edges, event, workflow, supabase);
        totalExecuted += actionResults.length;

        // Determine overall run status
        const hasError   = actionResults.some((r) => r.status === "error");
        const allSkipped = actionResults.every((r) => r.status === "skipped");
        const status     = hasError ? "partial" : allSkipped ? "skipped" : "success";

        // Write execution log
        await supabase.from("sentinel_workflow_runs").insert({
          workflow_id:      workflow.id,
          tenant_id:        orgId,
          trigger_event_id: event.id,
          trigger_label:    trigger.data?.label ?? "Unknown",
          actions_executed: actionResults,
          status,
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, executedActions: totalExecuted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Workflow execution error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
