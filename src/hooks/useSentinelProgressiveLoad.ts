export const useSentinelProgressiveLoad = (opts?: any) => {
  return { isLoaded: true, events: [], isLoadingMore: false, cappedAt10k: false, error: null };
};
