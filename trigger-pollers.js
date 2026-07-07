import fs from 'fs';

const SUPABASE_URL = "https://bmnrwukxkskdazwrralw.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtbnJ3dWt4a3NrZGF6d3JyYWx3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzNTI1NzIsImV4cCI6MjA5ODkyODU3Mn0.m318rw9rXhaC8Zi-kWwnd7NJDl1Awvl5kSgbdB0Bc5s";

const pollers = [
  "sentinel-gdelt-poller",
  "sentinel-usgs-poller",
  "sentinel-gdacs-poller",
  "sentinel-firms-poller",
  "sentinel-reliefweb-poller",
  "sentinel-acled-poller",
  "sentinel-fred-poller",
  "sentinel-imf-poller",
  "sentinel-worldbank-poller"
];

async function triggerAll() {
  console.log("Triggering all Sentinel pollers manually...\n");

  for (const poller of pollers) {
    try {
      console.log(`Triggering ${poller}...`);
      const response = await fetch(`${SUPABASE_URL}/functions/v1/${poller}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({})
      });
      
      const text = await response.text();
      console.log(`[${response.status}] ${poller}: ${text.slice(0, 100)}`);
    } catch (e) {
      console.error(`Failed to trigger ${poller}:`, e.message);
    }
  }
  
  console.log("\nFinished triggering all pollers. Check your dashboard feed shortly!");
}

triggerAll();
