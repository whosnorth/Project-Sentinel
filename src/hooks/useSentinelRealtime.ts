export interface SentinelEvent {
  id: string;
  source: string;
  type: string;
  content: string;
  location: { lat: number; lng: number };
  country_code?: string;
  created_at?: string;
  severity?: string;
  title?: string;
  url?: string;
}
export const useSentinelRealtime = (filters?: any) => {
  return { events: [] };
};
