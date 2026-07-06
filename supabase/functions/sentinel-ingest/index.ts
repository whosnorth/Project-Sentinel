// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apiKey = Deno.env.get("FIREWORKS_API_KEY")!;

    // Create a Supabase client with the service role key to bypass RLS
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // 1. Verify API Key
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing or invalid Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = authHeader.split(" ")[1];
    
    // Call our verify_api_key RPC
    const { data: verifyData, error: verifyError } = await supabase.rpc("verify_api_key", {
      input_key: apiKey,
    });

    if (verifyError || !verifyData || !verifyData.valid) {
      console.error("Invalid API Key:", verifyError || "Key not found");
      return new Response(JSON.stringify({ error: "Unauthorized: Invalid API Key" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ownerId = verifyData.owner_id;

    // 2. Fetch the Organization ID for this owner
    const { data: userRole, error: roleError } = await supabase
      .from("user_roles")
      .select("organization_id")
      .eq("user_id", ownerId)
      .limit(1)
      .single();

    if (roleError || !userRole || !userRole.organization_id) {
      return new Response(JSON.stringify({ error: "No organization associated with this API key" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const organizationId = userRole.organization_id;

    // 3. Parse the Request Payload
    const { title, content, metadata } = await req.json();

    if (!title || !content) {
      return new Response(JSON.stringify({ error: "Missing required fields: title, content" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Generate Embedding via AI Platform (using a small embedding model or fallback to standard model)
    // Note: Since AI Platform doesn't specialize in embeddings as heavily, if you use a specific embedding model
    // you must format the request correctly. We'll use text-embedding-3-small or similar via AI Platform.
    console.log(`Generating embedding for: ${title}`);
    
    // We combine title and content for the embedding
    const textToEmbed = `Title: ${title}\n\nContent: ${content}`.substring(0, 8000); // truncate just in case

    const embedRes = await fetch("https://api.fireworks.ai/inference/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small", // or "text-embedding-ada-002"
        input: textToEmbed,
      }),
    });

    if (!embedRes.ok) {
      const errorText = await embedRes.text();
      console.error("Embedding generation failed:", errorText);
      return new Response(JSON.stringify({ error: "Failed to generate embeddings", details: errorText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const embedData = await embedRes.json();
    const embedding = embedData.data[0].embedding;

    // 5. Insert into private_knowledge
    const { data: insertedData, error: insertError } = await supabase
      .from("private_knowledge")
      .insert({
        organization_id: organizationId,
        title,
        content,
        metadata: metadata || {},
        embedding,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Failed to insert into private_knowledge:", insertError);
      return new Response(JSON.stringify({ error: "Database insertion failed", details: insertError }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Successfully ingested alternative data",
      id: insertedData.id
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Ingestion Error:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error", details: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

