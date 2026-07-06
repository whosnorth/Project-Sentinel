import { Handle, Position } from '@xyflow/react';
import { Play } from 'lucide-react';

type ActionNodeData = {
  label: string;
  description?: string;
  config?: Record<string, any>;
};

export function ActionNode({ data }: { data: ActionNodeData }) {
  return (
    <div className="min-w-[200px] rounded-md border border-[#ff0055]/50 bg-[#080c10]/95 px-4 py-3 shadow-[0_0_15px_rgba(255,0,85,0.15)] backdrop-blur-md">
      <div className="flex items-center gap-2 mb-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#ff0055]/20">
          <Play className="h-3.5 w-3.5 text-[#ff0055] ml-0.5" />
        </div>
        <div className="font-mono text-xs font-bold text-[#ff0055] uppercase tracking-wider">
          Action Node
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
      
      {/* Actions have an input handle (Target) */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-[#ff0055] border-2 border-[#080c10]"
      />
      
      {/* Actions can also optionally chain output, but for simple phase 1 we'll allow chaining */}
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-[#ff0055] border-2 border-[#080c10]"
      />
    </div>
  );
}
