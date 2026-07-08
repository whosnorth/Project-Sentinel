const SUPABASE_URL = "https://bmnrwukxkskdazwrralw.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtbnJ3dWt4a3NrZGF6d3JyYWx3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzNTI1NzIsImV4cCI6MjA5ODkyODU3Mn0.m318rw9rXhaC8Zi-kWwnd7NJDl1Awvl5kSgbdB0Bc5s";

async function runBenchmarks() {
  console.log("Starting Project Sentinel Performance Benchmarks...\n");

  // 1. Measure Vector Search Latency
  console.log("--- Vector Search Latency ---");
  const embedding = Array(768).fill(0).map(() => Math.random());
  
  let totalTime = 0;
  const iterations = 5;
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/hybrid_search_events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify({
        p_query_text: "test query",
        p_query_embedding: embedding,
        p_match_count: 10,
        p_organization_id: "00000000-0000-0000-0000-000000000000"
      })
    });
    const data = await res.json();
    const end = performance.now();
    
    if (!res.ok) {
      console.log("Error in vector search:", data);
      continue;
    }
    const duration = end - start;
    totalTime += duration;
    console.log(`Run ${i + 1}: ${duration.toFixed(2)}ms`);
  }
  console.log(`Average Vector Search Latency: ${(totalTime / iterations).toFixed(2)}ms\n`);

  // 2. Workflow Edge Function Latency
  console.log("--- Workflow Engine Latency ---");
  const testEvent = {
    headline: "[BENCHMARK] Test Geospatial Event",
    event_type: "benchmark",
    source: "local-test",
    severity: 10,
    lat: 34.05,
    lng: -118.25,
    created_at: new Date().toISOString()
  };

  let totalWorkflowTime = 0;
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    const res = await fetch(`${SUPABASE_URL}/functions/v1/execute-sentinel-workflows`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify({ record: testEvent })
    });
    const text = await res.text();
    const end = performance.now();
    
    const duration = end - start;
    totalWorkflowTime += duration;
    console.log(`Run ${i + 1}: ${duration.toFixed(2)}ms (Status: ${res.status})`);
  }
  console.log(`Average Workflow Execution Latency: ${(totalWorkflowTime / iterations).toFixed(2)}ms\n`);
  
  // 3. Count total events
  console.log("--- Database Stats ---");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/sentinel_events?select=id`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': 'count=exact'
    }
  });
  const count = res.headers.get('content-range')?.split('/')[1] || 0;
  console.log(`Total events indexed: ${count}`);
}

runBenchmarks();
