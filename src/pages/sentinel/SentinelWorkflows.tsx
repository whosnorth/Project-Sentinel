import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  BackgroundVariant,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { Map, Marker } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";

const createGeoJSONCircle = (center: [number, number], radiusInKm: number, points: number = 64) => {
  const coords = { latitude: center[1], longitude: center[0] };
  const km = radiusInKm;
  const ret = [];
  const distanceX = km / (111.320 * Math.cos(coords.latitude * Math.PI / 180));
  const distanceY = km / 110.574;

  for (let i = 0; i < points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    const x = distanceX * Math.cos(theta);
    const y = distanceY * Math.sin(theta);
    ret.push([coords.longitude + x, coords.latitude + y]);
  }
  ret.push([ret[0][0], ret[0][1]]); // close the polygon

  return {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [ret]
    }
  };
};

import { TriggerNode } from '@/components/sentinel/workflows/TriggerNode';
import { ActionNode } from '@/components/sentinel/workflows/ActionNode';
import { WorkflowRunLog } from '@/components/sentinel/workflows/WorkflowRunLog';
import { Button } from '@/components/ui/button';
import { Plus, Save, LayoutGrid, FolderOpen, Trash2, MapPin, Play, Power, PowerOff, Check } from 'lucide-react';
import { toast } from 'sonner';
import { supabase, SUPABASE_URL } from '@/integrations/supabase/client';
import { useAuth } from '@/components/AuthProvider';

function WorkflowCanvas() {
  const { organizationId } = useAuth();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isRunningNow, setIsRunningNow] = useState(false);
  const [emailSaved, setEmailSaved] = useState<string | null>(null);
  
  const [currentWorkflowId, setCurrentWorkflowId] = useState<string | null>(null);
  const [currentWorkflowName, setCurrentWorkflowName] = useState<string>('Untitled Workflow');
  const [showSidebar, setShowSidebar] = useState(false);
  const [savedWorkflows, setSavedWorkflows] = useState<any[]>([]);
  const [unlockedRadii, setUnlockedRadii] = useState<Record<string, boolean>>();

  const nodeTypes = useMemo(() => ({
    triggerNode: TriggerNode,
    actionNode: ActionNode,
  }), []);

  const mapRef = useRef<any>(null);

  const selectedNodeDataString = useMemo(() => {
    const sel = nodes.find(n => n.selected);
    return sel ? JSON.stringify(sel.data.config) : null;
  }, [nodes]);

  const circleData = useMemo(() => {
    const sel = nodes.find(n => n.selected);
    if (!sel || (sel.data.config as any)?.lng === undefined) return null;
    return createGeoJSONCircle(
      [(sel.data.config as any).lng, (sel.data.config as any).lat],
      Number((sel.data.config as any).radius) || 500
    );
  }, [selectedNodeDataString]);

  const updateMapCircle = useCallback(() => {
    const map = mapRef.current?.getMap?.();
    if (!map) return;
    if (circleData) {
      if (map.getSource('radius-source')) {
        (map.getSource('radius-source') as any).setData(circleData);
      } else {
        map.addSource('radius-source', { type: 'geojson', data: circleData });
        map.addLayer({ id: 'radius-fill', type: 'fill', source: 'radius-source', paint: { 'fill-color': '#00f0ff', 'fill-opacity': 0.15 } });
        map.addLayer({ id: 'radius-line', type: 'line', source: 'radius-source', paint: { 'line-color': '#00f0ff', 'line-width': 2, 'line-dasharray': [2, 2] } });
      }
    } else {
      if (map.getLayer('radius-fill')) map.removeLayer('radius-fill');
      if (map.getLayer('radius-line')) map.removeLayer('radius-line');
      if (map.getSource('radius-source')) map.removeSource('radius-source');
    }
  }, [circleData]);

  useEffect(() => {
    const map = mapRef.current?.getMap?.();
    if (map && map.isStyleLoaded()) {
      updateMapCircle();
    }
  }, [updateMapCircle]);

  const fetchWorkflows = async () => {
    if (!organizationId) return;
    const { data, error } = await (supabase as any)
      .from('sentinel_workflows')
      .select('id, name, description, updated_at')
      .eq('tenant_id', organizationId)
      .order('updated_at', { ascending: false });
    
    if (error) {
      console.error(error);
      toast.error('Failed to load workflows');
    } else {
      setSavedWorkflows(data || []);
    }
  };

  useEffect(() => {
    if (showSidebar) {
      fetchWorkflows();
    }
  }, [showSidebar, organizationId]);

  const loadWorkflow = async (id: string) => {
    const { data, error } = await (supabase as any)
      .from('sentinel_workflows')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      toast.error('Error loading workflow');
      return;
    }

    setNodes(data.nodes as Node[] || []);
    setEdges(data.edges as Edge[] || []);
    setCurrentWorkflowId(data.id);
    setCurrentWorkflowName(data.name);
    setShowSidebar(false);
    toast.success('Workflow loaded');
  };

  const deleteWorkflow = async (id: string) => {
    if (!confirm('Are you sure you want to delete this workflow?')) return;
    const { error } = await (supabase as any).from('sentinel_workflows').delete().eq('id', id);
    if (error) {
      toast.error('Error deleting workflow');
    } else {
      toast.success('Workflow deleted');
      if (currentWorkflowId === id) {
        setNodes([]);
        setEdges([]);
        setCurrentWorkflowId(null);
        setCurrentWorkflowName('Untitled Workflow');
      }
      fetchWorkflows();
    }
  };

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#00f0ff' } }, eds)),
    [setEdges]
  );

  const handleAddTrigger = () => {
    const newNode: Node = {
      id: `trigger-${Date.now()}`,
      type: 'triggerNode',
      position: { x: Math.random() * 200 + 100, y: Math.random() * 200 + 100 },
      data: {
        label: 'New Logic Trigger',
        description: 'Configure conditions for this trigger.',
      },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const handleAddAction = () => {
    const newNode: Node = {
      id: `action-${Date.now()}`,
      type: 'actionNode',
      position: { x: Math.random() * 200 + 400, y: Math.random() * 200 + 100 },
      data: {
        label: 'New Workflow Action',
        description: 'Configure what happens next.',
      },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const handleToggleActive = async (id: string, currentState: boolean) => {
    const { error } = await (supabase as any)
      .from('sentinel_workflows')
      .update({ is_active: !currentState })
      .eq('id', id);
    if (error) {
      toast.error('Failed to update workflow status');
    } else {
      toast.success(`Workflow ${!currentState ? 'activated' : 'deactivated'}`);
      setSavedWorkflows(prev => prev.map(wf => wf.id === id ? { ...wf, is_active: !currentState } : wf));
    }
  };

  const handleRunNow = async () => {
    if (!currentWorkflowId) {
      toast.error('Save the workflow first before running a test.');
      return;
    }
    setIsRunningNow(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      
      // Fetch the latest event to use for the test run so Deep Research actually finds it
      const { data: latestEvent } = await supabase
        .from('sentinel_events')
        .select('*')
        .order('occurred_at', { ascending: false })
        .limit(1)
        .single();
        
      if (!latestEvent) {
        toast.error('No events found in the database to test with.');
        setIsRunningNow(false);
        return;
      }
      
      const testEvent = {
        ...latestEvent,
        headline: `[TEST RUN] ${latestEvent.headline}`,
      };
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/execute-sentinel-workflows`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ record: testEvent }),
        }
      );
      const data = await res.json();
      if (res.ok) {
        toast.success(`Test run complete — ${data.executedActions ?? 0} action(s) executed`);
      } else {
        toast.error(`Test run failed: ${data.error ?? 'Unknown error'}`);
      }
    } catch (err: any) {
      toast.error(`Test run error: ${err.message}`);
    } finally {
      setIsRunningNow(false);
    }
  };

  const handleSave = async () => {
    if (!organizationId) {
      toast.error('Cannot save: No active organization ID found.');
      return;
    }
    
    setIsSaving(true);
    try {
      if (currentWorkflowId) {
        // Update existing
        const { error } = await (supabase as any).from('sentinel_workflows').update({
          name: currentWorkflowName,
          nodes: nodes as any,
          edges: edges as any,
        }).eq('id', currentWorkflowId);
        if (error) throw error;
        toast.success('Workflow updated successfully!');
      } else {
        // Insert new
        const newName = prompt('Enter workflow name:', 'My New Workflow');
        if (!newName) {
          setIsSaving(false);
          return;
        }
        const { data, error } = await (supabase as any).from('sentinel_workflows').insert({
          tenant_id: organizationId,
          name: newName,
          description: 'Custom workflow',
          nodes: nodes as any,
          edges: edges as any,
        }).select().single();
        if (error) throw error;
        setCurrentWorkflowId(data.id);
        setCurrentWorkflowName(data.name);
        toast.success('New workflow saved successfully!');
      }
    } catch (err: any) {
      console.error('Save error:', err);
      toast.error(`Failed to save workflow: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-44px)] flex-col bg-[#080c10] overflow-hidden">
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b border-white/10 bg-[#0a0f16] p-4">
        <div>
          <h1 className="font-mono text-xl font-bold tracking-tight text-white uppercase flex items-center gap-2">
            <LayoutGrid className="h-5 w-5 text-[#00f0ff]" />
            Workflow Engine
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-sm text-slate-400 font-sans">
              Editing: <span className="text-white font-medium">{currentWorkflowName}</span>
            </p>
            {currentWorkflowId && (
              <Button variant="ghost" size="sm" onClick={() => { setCurrentWorkflowId(null); setNodes([]); setEdges([]); setCurrentWorkflowName('Untitled Workflow'); }} className="h-5 px-2 text-xs text-slate-500 hover:text-white">
                Clear
              </Button>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setShowSidebar(!showSidebar)} className="bg-transparent border-slate-700 text-slate-300 hover:bg-slate-800">
            <FolderOpen className="mr-2 h-4 w-4" />
            Library
          </Button>
          <div className="h-6 w-px bg-white/10 mx-1" />
          <Button variant="outline" size="sm" onClick={handleAddTrigger} className="bg-transparent border-[#00f0ff]/30 text-[#00f0ff] hover:bg-[#00f0ff]/10">
            <Plus className="mr-2 h-4 w-4" />
            Add Trigger
          </Button>
          <Button variant="outline" size="sm" onClick={handleAddAction} className="bg-transparent border-[#ff0055]/30 text-[#ff0055] hover:bg-[#ff0055]/10">
            <Plus className="mr-2 h-4 w-4" />
            Add Action
          </Button>
          <div className="h-6 w-px bg-white/10 mx-1" />
          <Button
            variant="outline"
            size="sm"
            onClick={handleRunNow}
            disabled={isRunningNow || !currentWorkflowId}
            className="bg-transparent border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-40"
            title={!currentWorkflowId ? 'Save the workflow first' : 'Test run with a synthetic severity-10 event'}
          >
            <Play className="mr-2 h-3.5 w-3.5" />
            {isRunningNow ? 'Running…' : 'Run Now'}
          </Button>
          <Button 
            variant="default" 
            size="sm" 
            onClick={handleSave} 
            disabled={isSaving}
            className="bg-[#00f0ff] text-black hover:bg-[#00f0ff]/80 font-bold"
          >
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? 'Saving...' : (currentWorkflowId ? 'Update Pipeline' : 'Save New Pipeline')}
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 relative overflow-hidden">
        
        {/* Sidebar overlay for loading workflows */}
        {showSidebar && (
          <div className="absolute top-0 left-0 bottom-0 w-80 bg-[#0a0f16] border-r border-white/10 z-10 flex flex-col shadow-2xl">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-[#080c10]">
              <h2 className="text-white font-mono font-bold text-sm">Saved Workflows</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {savedWorkflows.length === 0 ? (
                <p className="text-slate-500 text-sm text-center mt-4">No workflows found.</p>
              ) : (
                savedWorkflows.map(wf => (
                  <div key={wf.id} className="p-3 rounded bg-slate-900/50 border border-white/5 hover:border-white/20 transition-colors group">
                    <div className="flex justify-between items-start">
                      <div className="cursor-pointer flex-1" onClick={() => loadWorkflow(wf.id)}>
                        <h3 className="text-sm font-medium text-white">{wf.name}</h3>
                        <p className="text-xs text-slate-400 mt-1">{new Date(wf.updated_at).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {/* Active/Inactive toggle */}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleToggleActive(wf.id, wf.is_active); }}
                          title={wf.is_active ? 'Deactivate' : 'Activate'}
                          className={`flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[8px] uppercase transition-colors ${
                            wf.is_active
                              ? 'bg-emerald-500/20 text-emerald-400 hover:bg-red-500/20 hover:text-red-400'
                              : 'bg-zinc-800 text-zinc-500 hover:bg-emerald-500/20 hover:text-emerald-400'
                          }`}
                        >
                          {wf.is_active ? <Power className="h-2.5 w-2.5" /> : <PowerOff className="h-2.5 w-2.5" />}
                          {wf.is_active ? 'Live' : 'Off'}
                        </button>
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); deleteWorkflow(wf.id); }} className="h-6 w-6 text-slate-500 hover:text-red-400">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Canvas */}
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
            className="bg-[#080c10]"
            colorMode="dark"
            deleteKeyCode={["Backspace", "Delete"]}
          >
            <Background color="rgba(255,255,255,0.05)" variant={BackgroundVariant.Dots} gap={24} size={1} />
            <Controls className="bg-[#0a0f16] border border-white/10 fill-white text-white" />
            <MiniMap 
              nodeColor={(node) => {
                if (node.type === 'triggerNode') return '#00f0ff';
                return '#ff0055';
              }}
              maskColor="rgba(8, 12, 16, 0.7)"
              className="bg-[#0a0f16] border border-white/10"
            />
          </ReactFlow>
          
          {/* Live status indicator */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-400 backdrop-blur-md pointer-events-none z-10">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Workflow engine online · Fires automatically on event ingestion
          </div>
        </div>

        {/* Properties Sidebar (Right) */}
        {(() => {
          const selectedNode = nodes.find(n => n.selected);
          if (!selectedNode) return null;

          const isTrigger = selectedNode.type === 'triggerNode';
          const options = isTrigger ? [
            { label: 'Geospatial Event Detected', desc: 'Triggers when a Severity 8+ event occurs in a region' },
            { label: 'Cyber Threat Identified', desc: 'Triggers on confirmed infrastructure compromise' },
            { label: 'Financial Market Anomaly', desc: 'Triggers on sudden currency devaluation or crash' },
            { label: 'Supply Chain Disruption', desc: 'Triggers when a major logistics route is blocked' },
            { label: 'Country Stability Threshold', desc: 'Triggers when a country CSI score drops below a set threshold' },
            { label: 'Keyword Match Detected', desc: 'Triggers when an event contains specific buzzwords' },
          ] : [
            { label: 'Run Deep Research', desc: 'Extracts supply chain entities and graphs the impact cascade' },
            { label: 'Send Webhook URL', desc: 'Sends JSON payload to external system' },
            { label: 'Generate Intel Report', desc: 'Uses AI to summarize the cascading impact and emails the report' },
            { label: 'Alert Sentinel Analysts', desc: 'Pushes high-priority notification to all analysts in org' },
            { label: 'Send Email Alert', desc: 'Sends an automated email alert to a specific address' },
          ];

          return (
            <div className="w-80 bg-[#0a0f16] border-l border-white/10 z-10 flex flex-col shadow-2xl">
              <div className="p-4 border-b border-white/10 bg-[#080c10]">
                <h2 className="text-white font-mono font-bold text-sm">
                  {isTrigger ? 'Trigger Configuration' : 'Action Configuration'}
                </h2>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                <div>
                  <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block">
                    Select Type
                  </label>
                  <select 
                    className="w-full bg-[#080c10] border border-white/20 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00f0ff]"
                    value={selectedNode.data.label as string}
                    onChange={(e) => {
                      const selectedOpt = options.find(o => o.label === e.target.value);
                      if (selectedOpt) {
                        setNodes(nds => nds.map(n => {
                          if (n.id === selectedNode.id) {
                            // Reset config when type changes
                            return { ...n, data: { ...n.data, label: selectedOpt.label, description: selectedOpt.desc, config: {} } };
                          }
                          return n;
                        }));
                      }
                    }}
                  >
                    <option value="" disabled>Select an option...</option>
                    {options.map(opt => (
                      <option key={opt.label} value={opt.label}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 block">
                    Description
                  </label>
                  <p className="text-sm text-slate-300 bg-slate-900/50 p-3 rounded border border-white/5 leading-relaxed">
                    {selectedNode.data.description as string || 'No description available.'}
                  </p>
                </div>

                {/* Dynamic Configuration Fields */}
                <div className="pt-4 border-t border-white/10">
                  <h3 className="text-xs text-[#00f0ff] font-mono mb-4 uppercase tracking-wider">Parameters</h3>
                  
                  {selectedNode.data.label === 'Geospatial Event Detected' && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs text-slate-400 block">Minimum Severity (0-10)</label>
                        <input 
                          type="number" 
                          min="0" max="10"
                          className="w-full bg-slate-900/50 border border-white/20 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#00f0ff]"
                          value={(selectedNode.data.config as any)?.severity || 8}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNodes(nds => nds.map(n => {
                              if (n.id === selectedNode.id) {
                                return { 
                                  ...n, 
                                  data: { 
                                    ...n.data, 
                                    config: { ...(n.data.config as any || {}), severity: val },
                                    description: `Triggers when a Severity ${val || 0}+ event occurs in selected region`
                                  } 
                                };
                              }
                              return n;
                            }));
                          }}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-xs text-slate-400 block">Target Region</label>
                        <div className="w-full h-40 bg-slate-900/50 border border-white/20 rounded overflow-hidden relative">
                          <Map
                            initialViewState={{
                              longitude: (selectedNode.data.config as any)?.lng || 0,
                              latitude: (selectedNode.data.config as any)?.lat || 20,
                              zoom: 1,
                            }}
                            mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
                            ref={mapRef}
                            onLoad={updateMapCircle}
                            onClick={(e) => {
                              const { lng, lat } = e.lngLat;
                              setNodes(nds => nds.map(n => {
                                if (n.id === selectedNode.id) {
                                  return {
                                    ...n,
                                    data: {
                                      ...n.data,
                                      config: { ...(n.data.config as any || {}), lng, lat }
                                    }
                                  };
                                }
                                return n;
                              }));
                            }}
                          >
                            {(selectedNode.data.config as any)?.lng !== undefined && (
                              <Marker 
                                longitude={(selectedNode.data.config as any).lng} 
                                latitude={(selectedNode.data.config as any).lat}
                              >
                                <div className="text-[#00f0ff] animate-pulse">
                                  <MapPin size={24} className="fill-[#00f0ff]/20" />
                                </div>
                              </Marker>
                            )}
                          </Map>
                          <div className="absolute top-2 left-2 pointer-events-none bg-black/60 px-2 py-1 rounded text-[10px] text-white backdrop-blur-sm border border-white/10">
                            Click to place center pin
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs text-slate-400 flex justify-between items-center">
                          <span>Radius (km)</span>
                          <div className="flex items-center gap-1">
                            <input 
                              type="number"
                              min="10"
                              max="10000"
                              className="bg-black border border-white/10 rounded px-1 py-0.5 text-[#00f0ff] w-20 text-right font-mono text-xs"
                              value={(selectedNode.data.config as any)?.radius || 500}
                              onChange={(e) => {
                                const v = parseInt(e.target.value);
                                if (!isNaN(v)) {
                                  setNodes(nds => nds.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, config: { ...(n.data.config as any || {}), radius: v } } } : n));
                                }
                              }}
                            />
                            <span className="text-[#00f0ff] text-xs">km</span>
                          </div>
                        </label>
                        <input 
                          type="range" 
                          min="10" max="10000" step="10"
                          className="w-full accent-[#00f0ff]"
                          value={(selectedNode.data.config as any)?.radius || 500}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNodes(nds => nds.map(n => {
                              if (n.id === selectedNode.id) {
                                return { 
                                  ...n, 
                                  data: { 
                                    ...n.data, 
                                    config: { ...(n.data.config as any || {}), radius: val }
                                  } 
                                };
                              }
                              return n;
                            }));
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {selectedNode.data.label === 'Send Webhook URL' && (
                    <div className="space-y-2">
                      <label className="text-xs text-slate-400 block">Endpoint URL</label>
                      <input 
                        type="url" 
                        placeholder="https://api.example.com/webhook"
                        className="w-full bg-slate-900/50 border border-white/20 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#ff0055]"
                        value={(selectedNode.data.config as any)?.url || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNodes(nds => nds.map(n => {
                            if (n.id === selectedNode.id) {
                              return { 
                                ...n, 
                                data: { 
                                  ...n.data, 
                                  config: { ...(n.data.config as any || {}), url: val },
                                  description: `Sends JSON payload to ${val || 'external system'}`
                                } 
                              };
                            }
                            return n;
                          }));
                        }}
                      />
                    </div>
                  )}

                  {selectedNode.data.label === 'Alert Sentinel Analysts' && (
                    <div className="space-y-2">
                      <label className="text-xs text-slate-400 block">Priority Level</label>
                      <select 
                        className="w-full bg-slate-900/50 border border-white/20 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#ff0055]"
                        value={(selectedNode.data.config as any)?.priority || 'High'}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNodes(nds => nds.map(n => {
                            if (n.id === selectedNode.id) {
                              return { 
                                ...n, 
                                data: { 
                                  ...n.data, 
                                  config: { ...(n.data.config as any || {}), priority: val },
                                  description: `Pushes ${val.toLowerCase()}-priority notification to dashboard`
                                } 
                              };
                            }
                            return n;
                          }));
                        }}
                      >
                        <option value="Critical">Critical</option>
                        <option value="High">High</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                      </select>
                    </div>
                  )}

                  {/* Country Stability Threshold params */}
                  {selectedNode.data.label === 'Country Stability Threshold' && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs text-slate-400 block">Country Code (ISO)</label>
                        <input
                          type="text"
                          maxLength={2}
                          placeholder="e.g. NG"
                          className="w-full bg-slate-900/50 border border-white/20 rounded px-3 py-2 text-sm text-white uppercase focus:outline-none focus:border-[#00f0ff]"
                          value={(selectedNode.data.config as any)?.country_code || ''}
                          onChange={(e) => {
                            const val = e.target.value.toUpperCase();
                            setNodes(nds => nds.map(n => {
                              if (n.id !== selectedNode.id) return n;
                              return { ...n, data: { ...n.data, config: { ...(n.data.config as any || {}), country_code: val }, description: `Triggers when CSI for ${val} drops below ${(n.data.config as any)?.threshold ?? 40}` } };
                            }));
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs text-slate-400 flex justify-between">
                          <span>CSI Threshold</span>
                          <span className="text-[#00f0ff]">{(selectedNode.data.config as any)?.threshold ?? 40}/100</span>
                        </label>
                        <input
                          type="range" min="0" max="100" step="5"
                          className="w-full accent-[#00f0ff]"
                          value={(selectedNode.data.config as any)?.threshold ?? 40}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNodes(nds => nds.map(n => {
                              if (n.id !== selectedNode.id) return n;
                              return { ...n, data: { ...n.data, config: { ...(n.data.config as any || {}), threshold: val }, description: `Triggers when CSI for ${(n.data.config as any)?.country_code ?? '??'} drops below ${val}` } };
                            }));
                          }}
                        />
                        <p className="text-[9px] text-slate-600">Fires when the country's stability score falls below this value (100 = most stable)</p>
                      </div>
                    </div>
                  )}

                  {/* Generate Intel Report — email field */}
                  {selectedNode.data.label === 'Generate Intel Report' && (
                    <div className="space-y-2">
                      <label className="text-xs text-slate-400 block">Send report to email</label>
                      <div className="relative">
                        <input
                          type="email"
                          placeholder="analyst@yourorg.com"
                          className="w-full bg-slate-900/50 border border-white/20 rounded px-3 py-2 pr-16 text-sm text-white focus:outline-none focus:border-[#ff0055]"
                          value={(selectedNode.data.config as any)?.report_email || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEmailSaved(null);
                            setNodes(nds => nds.map(n => {
                              if (n.id !== selectedNode.id) return n;
                              return { ...n, data: { ...n.data, config: { ...(n.data.config as any || {}), report_email: val }, description: `AI brief emailed to ${val || 'configured address'}` } };
                            }));
                          }}
                          onBlur={() => setEmailSaved((selectedNode.data.config as any)?.report_email || null)}
                          onKeyDown={(e) => { if (e.key === 'Enter') setEmailSaved((selectedNode.data.config as any)?.report_email || null); }}
                        />
                        {emailSaved && (selectedNode.data.config as any)?.report_email === emailSaved && (
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 font-mono text-[9px] text-emerald-400">
                            <Check className="h-3 w-3" /> Saved
                          </span>
                        )}
                      </div>
                      <p className="text-[9px] text-slate-600 leading-relaxed">
                        An AI-generated C-Suite intelligence brief will be emailed here each time this workflow fires.
                      </p>
                    </div>
                  )}

                  {!['Geospatial Event Detected', 'Send Webhook URL', 'Alert Sentinel Analysts', 'Country Stability Threshold', 'Generate Intel Report'].includes(selectedNode.data.label as string) && (
                    <p className="text-xs text-slate-500 italic">No customizable parameters for this node type.</p>
                  )}
                </div>

              </div>
            </div>
          );
        })()}
      </div>

      {/* Run History Panel */}
      <WorkflowRunLog workflowId={currentWorkflowId} />
    </div>
  );
}

// Wrapping with ReactFlowProvider allows us to use hooks like useReactFlow later if needed
export default function SentinelWorkflows() {
  return (
    <ReactFlowProvider>
      <WorkflowCanvas />
    </ReactFlowProvider>
  );
}
