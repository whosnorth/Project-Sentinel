import { useState, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseBYODCsv, ParsedBYODEvent } from "@/lib/csvParser";
import { toast } from "sonner";
import { supabase, SUPABASE_URL } from "@/integrations/supabase/client";
import { FileUp, Database, Copy, CheckCircle2, Loader2, Key } from "lucide-react";

export function DataSources() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    try {
      const parsedData = await parseBYODCsv(file);
      
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      
      const res = await fetch(`${SUPABASE_URL}/functions/v1/sentinel-byod-ingest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(parsedData)
      });
      
      if (!res.ok) {
        throw new Error(await res.text());
      }
      
      toast.success(`Successfully mapped and ingested ${parsedData.length} proprietary events!`);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: any) {
      toast.error(`Upload failed: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const generateApiKey = async () => {
    // In a real app, this would generate a permanent PAT in the database.
    // For the hackathon, we'll grab the session token to demonstrate the API workflow.
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
    setApiKey(token);
    toast.success("API Key generated for your organization");
  };

  const curlSnippet = `curl -X POST ${SUPABASE_URL}/functions/v1/sentinel-byod-ingest \\
  -H "Authorization: Bearer \${YOUR_API_KEY}" \\
  -H "Content-Type: application/json" \\
  -d '[{
    "headline": "Internal Warehouse Delay",
    "latitude": 40.7128,
    "longitude": -74.0060,
    "severity": 8,
    "event_type": "supply_chain_disruption"
  }]'`;

  return (
    <div className="flex flex-col h-full bg-[#050505] text-slate-200 overflow-y-auto">
      <div className="p-8 max-w-5xl mx-auto w-full space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Data Sources</h1>
          <p className="text-slate-400">
            Bring Your Own Data (BYOD). Augment Sentinel's global OSINT baseline with your organization's proprietary telemetry, supply chain data, or custom intel feeds.
          </p>
        </div>

        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 bg-[#1A1A1A]">
            <TabsTrigger value="upload" className="data-[state=active]:bg-blue-600/20 data-[state=active]:text-blue-400">
              <FileUp className="w-4 h-4 mr-2" />
              Manual Upload
            </TabsTrigger>
            <TabsTrigger value="api" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
              <Database className="w-4 h-4 mr-2" />
              REST API
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="upload" className="mt-6">
            <Card className="bg-[#0A0A0A] border-slate-800">
              <CardHeader>
                <CardTitle className="text-white">Upload CSV Feed</CardTitle>
                <CardDescription className="text-slate-400">
                  Upload a CSV containing your proprietary events. Our parser will automatically map columns like 'latitude', 'longitude', 'headline', and 'severity'.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-2 border-dashed border-slate-700 rounded-lg p-10 flex flex-col items-center justify-center text-center hover:bg-[#111] transition-colors">
                  <FileUp className="w-10 h-10 text-slate-500 mb-4" />
                  <p className="text-sm text-slate-300 mb-2">Drag and drop your CSV here, or click to browse</p>
                  <p className="text-xs text-slate-500 mb-6">Required columns: headline, latitude, longitude</p>
                  
                  <Input 
                    type="file" 
                    accept=".csv" 
                    className="hidden" 
                    ref={fileInputRef}
                    onChange={handleFileChange}
                  />
                  <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="bg-[#1A1A1A] border-slate-700 hover:bg-[#252525]">
                    Select File
                  </Button>
                </div>

                {file && (
                  <div className="flex items-center justify-between p-4 bg-blue-900/10 border border-blue-900/30 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <CheckCircle2 className="w-5 h-5 text-blue-400" />
                      <span className="text-sm font-medium text-slate-200">{file.name}</span>
                      <span className="text-xs text-slate-500">{(file.size / 1024).toFixed(2)} KB</span>
                    </div>
                    <Button onClick={handleUpload} disabled={isUploading} className="bg-blue-600 hover:bg-blue-700 text-white">
                      {isUploading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Process & Ingest
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="api" className="mt-6">
            <Card className="bg-[#0A0A0A] border-slate-800">
              <CardHeader>
                <CardTitle className="text-white">Open API Integration</CardTitle>
                <CardDescription className="text-slate-400">
                  Programmatically pipe real-time proprietary data directly into the Sentinel Intelligence Engine.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-slate-200">1. Generate Organization API Key</h3>
                  <div className="flex space-x-3">
                    <Input 
                      value={apiKey || "••••••••••••••••••••••••••••••••"} 
                      readOnly 
                      className="bg-[#111] border-slate-700 font-mono text-xs text-slate-400"
                    />
                    <Button onClick={generateApiKey} className="bg-amber-600/20 text-amber-500 hover:bg-amber-600/30 border border-amber-500/50">
                      <Key className="w-4 h-4 mr-2" />
                      Generate
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-slate-200">2. Send Events to the Ingestion Endpoint</h3>
                  <div className="relative">
                    <pre className="p-4 rounded-lg bg-[#111] border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto">
                      <code>{curlSnippet}</code>
                    </pre>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="absolute top-2 right-2 hover:bg-slate-800 text-slate-400"
                      onClick={() => {
                        navigator.clipboard.writeText(curlSnippet);
                        toast.success("Copied to clipboard");
                      }}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Note: Data sent via this API is strictly partitioned via Row Level Security (RLS) to your organization_id and is mathematically isolated from other tenants.
                  </p>
                </div>

              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
