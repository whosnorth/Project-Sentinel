CREATE TABLE IF NOT EXISTS public.sentinel_graph_nodes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid REFERENCES public.sentinel_events(id) ON DELETE CASCADE,
    label text NOT NULL,
    type text NOT NULL,
    metadata jsonb,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sentinel_graph_edges (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid REFERENCES public.sentinel_events(id) ON DELETE CASCADE,
    source_node_id uuid REFERENCES public.sentinel_graph_nodes(id) ON DELETE CASCADE,
    target_node_id uuid REFERENCES public.sentinel_graph_nodes(id) ON DELETE CASCADE,
    relationship text NOT NULL,
    weight numeric DEFAULT 1.0,
    created_at timestamptz DEFAULT now()
);

-- Add event_id to graph nodes and edges if they already existed without it (just in case)
ALTER TABLE public.sentinel_graph_nodes ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.sentinel_events(id) ON DELETE CASCADE;
ALTER TABLE public.sentinel_graph_edges ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.sentinel_events(id) ON DELETE CASCADE;

-- Create the RPC function
CREATE OR REPLACE FUNCTION public.upsert_graph_subnetwork(
    p_event_id uuid,
    p_nodes jsonb,
    p_edges jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_node jsonb;
    v_edge jsonb;
    v_source_id uuid;
    v_target_id uuid;
BEGIN
    -- Delete existing nodes/edges for this event to replace them cleanly
    DELETE FROM public.sentinel_graph_edges WHERE event_id = p_event_id;
    DELETE FROM public.sentinel_graph_nodes WHERE event_id = p_event_id;

    -- Insert nodes
    FOR v_node IN SELECT * FROM jsonb_array_elements(p_nodes)
    LOOP
        INSERT INTO public.sentinel_graph_nodes (
            id,
            event_id,
            label,
            type,
            metadata
        ) VALUES (
            gen_random_uuid(),
            p_event_id,
            v_node->>'label',
            v_node->>'type',
            v_node
        );
    END LOOP;

    -- Insert edges
    FOR v_edge IN SELECT * FROM jsonb_array_elements(p_edges)
    LOOP
        -- Look up source node ID
        SELECT id INTO v_source_id 
        FROM public.sentinel_graph_nodes 
        WHERE event_id = p_event_id AND label = v_edge->>'source_label'
        LIMIT 1;

        -- Look up target node ID
        SELECT id INTO v_target_id 
        FROM public.sentinel_graph_nodes 
        WHERE event_id = p_event_id AND label = v_edge->>'target_label'
        LIMIT 1;

        -- Only insert edge if both nodes were successfully resolved
        IF v_source_id IS NOT NULL AND v_target_id IS NOT NULL THEN
            INSERT INTO public.sentinel_graph_edges (
                id,
                event_id,
                source_node_id,
                target_node_id,
                relationship,
                weight
            ) VALUES (
                gen_random_uuid(),
                p_event_id,
                v_source_id,
                v_target_id,
                v_edge->>'relationship',
                COALESCE((v_edge->>'weight')::numeric, 1.0)
            );
        END IF;
    END LOOP;
END;
$$;
