import { Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SentinelLayout } from "./components/SentinelLayout";

// Lazy load Sentinel pages
import SentinelDashboard from "./pages/sentinel/SentinelDashboard";
import CountryIntelligence from "./pages/sentinel/CountryIntelligence";
import SentinelLiveFeed from "./pages/sentinel/LiveFeed";
import SentinelRiskMatrix from "./pages/sentinel/RiskMatrix";
import SentinelIntelChat from "./pages/sentinel/IntelChat";
import SentinelChatHistory from "./pages/sentinel/ChatHistory";
import SentinelWorkflows from "./pages/sentinel/SentinelWorkflows";

// Simple fallback
const LoadingFallback = () => (
  <div className="flex h-screen w-full items-center justify-center bg-[#080c10] text-amber-500">
    <div className="animate-pulse font-mono tracking-widest text-sm">INITIALIZING SENTINEL...</div>
  </div>
);

const App = () => (
  <BrowserRouter>
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/" element={<SentinelLayout />}>
          <Route index element={<SentinelDashboard />} />
          <Route path="country" element={<CountryIntelligence />} />
          <Route path="country/:code" element={<CountryIntelligence />} />
          <Route path="feed" element={<SentinelLiveFeed />} />
          <Route path="matrix" element={<SentinelRiskMatrix />} />
          <Route path="chat" element={<SentinelIntelChat />} />
          <Route path="history" element={<SentinelChatHistory />} />
          <Route path="workflows" element={<SentinelWorkflows />} />
        </Route>
      </Routes>
    </Suspense>
  </BrowserRouter>
);

export default App;
