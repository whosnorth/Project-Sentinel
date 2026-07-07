import Papa from 'papaparse';

export interface ParsedBYODEvent {
  headline: string;
  latitude: number;
  longitude: number;
  severity: number;
  event_type: string;
  occurred_at: string;
}

export function parseBYODCsv(file: File): Promise<ParsedBYODEvent[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const events = results.data.map((row: any) => {
            // Flexible column mapping logic for analysts
            const headline = row.headline || row.title || row.description || row.incident;
            const lat = parseFloat(row.latitude || row.lat || row.y);
            const lng = parseFloat(row.longitude || row.lng || row.long || row.x);
            const severity = parseInt(row.severity || row.risk_level || row.impact, 10);
            
            if (!headline) throw new Error("Missing headline/title column");
            if (isNaN(lat) || isNaN(lng)) throw new Error(`Invalid coordinates for event: ${headline}`);

            return {
              headline,
              latitude: lat,
              longitude: lng,
              severity: isNaN(severity) ? 5 : Math.max(1, Math.min(10, severity)), // Clamp 1-10
              event_type: (row.event_type || row.category || 'custom_internal_event').toLowerCase().trim(),
              occurred_at: row.occurred_at || row.date || new Date().toISOString()
            };
          });
          resolve(events);
        } catch (e) {
          reject(e);
        }
      },
      error: (error) => {
        reject(error);
      }
    });
  });
}
