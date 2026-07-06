import { Handle, Position } from '@xyflow/react';
import { Zap } from 'lucide-react';

type TriggerNodeData = {
  label: string;
  description?: string;
  config?: Record<string, any>;
};

export function TriggerNode({ data }: { data: TriggerNodeData }) {
  return (
    <div className="min-w-[200px] rounded-md border border-[#00f0ff]/50 bg-[#080c10]/95 px-4 py-3 shadow-[0_0_15px_rgba(0,240,255,0.15)] backdrop-blur-md">
      <div className="flex items-center gap-2 mb-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#00f0ff]/20">
          <Zap className="h-3.5 w-3.5 text-[#00f0ff]" />
        </div>
        <div className="font-mono text-xs font-bold text-[#00f0ff] uppercase tracking-wider">
          Trigger Node
        </div>
      </div>
      <div className="font-sans text-sm text-slate-200">
        {data.label}
      </div>
      {data.description && (
        <div className="mt-1 font-sans text-xs text-slate-400">
          {data.description}
        </div>
      )}
      
      {/* Triggers only have output handles (Source) */}
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-[#00f0ff] border-2 border-[#080c10]"
      />
    </div>
  );
}
