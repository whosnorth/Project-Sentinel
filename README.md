# Project Sentinel

Project Sentinel is a centralized threat intelligence command center. It maps live global events to dynamic risk matrices and features an AI-driven chat for instant intel analysis. Equipped with automated workflows, Sentinel helps organizations proactively mitigate operational and geopolitical risks in real time.

## 🚀 AMD Compute Usage (Track 3: Unicorn)

**Project Sentinel relies on AMD compute resources to power its core AI reasoning and intelligence analysis.** 

Specifically, we leverage **AMD MI300X Accelerators** via [Fireworks AI](https://fireworks.ai/) to run our multi-agent intelligence pipeline:
- **Macro-Orchestrator Reasoning Engine:** Powered by `accounts/fireworks/models/deepseek-v4-pro` running on AMD MI300X hardware for deep reasoning over geopolitical supply chain effects.
- **Multimodal Visual Intelligence:** Powered by `accounts/fireworks/models/qwen3p7-plus` running on AMD MI300X hardware to analyze live satellite imagery and field event photos.
- **Data Formatting & Sandboxing:** Powered by `accounts/fireworks/models/deepseek-v4-flash` for blazing-fast, low-latency entity extraction and deterministic graph building on AMD hardware.

Our Supabase Edge Functions directly invoke these AMD-backed endpoints, ensuring that every live event ingestion, threat analysis, and chat query heavily utilizes AMD compute.

## Architecture

- **Frontend:** React, TypeScript, Vite, TailwindCSS, Deck.gl (for high-performance geospatial mapping)
- **Backend:** Supabase (PostgreSQL, Edge Functions)
- **AI Infrastructure:** Fireworks AI (AMD MI300X instances)
- **Data Ingestion:** Real-time polling from ACLED, GDACS, ReliefWeb, FIRMS, USGS, and World Bank APIs.

## Setup Instructions

1. Clone the repository.
2. Run `npm install`.
3. Set up your `.env` file using `.env.example`.
4. Start the development server with `npm run dev`.
5. Ensure your Supabase Edge Functions are deployed and configured with your Fireworks API key.
