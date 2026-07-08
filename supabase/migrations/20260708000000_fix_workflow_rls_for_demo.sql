DROP POLICY IF EXISTS "Users can view their organization's workflows" ON public.sentinel_workflows;
DROP POLICY IF EXISTS "Users can insert workflows for their organization" ON public.sentinel_workflows;
DROP POLICY IF EXISTS "Users can update their organization's workflows" ON public.sentinel_workflows;
DROP POLICY IF EXISTS "Users can delete their organization's workflows" ON public.sentinel_workflows;

CREATE POLICY "Users can view their organization's workflows"
    ON public.sentinel_workflows FOR SELECT
    USING (tenant_id = auth.uid() OR tenant_id = (auth.jwt() ->> 'organization_id')::UUID);

CREATE POLICY "Users can insert workflows for their organization"
    ON public.sentinel_workflows FOR INSERT
    WITH CHECK (tenant_id = auth.uid() OR tenant_id = (auth.jwt() ->> 'organization_id')::UUID);

CREATE POLICY "Users can update their organization's workflows"
    ON public.sentinel_workflows FOR UPDATE
    USING (tenant_id = auth.uid() OR tenant_id = (auth.jwt() ->> 'organization_id')::UUID);

CREATE POLICY "Users can delete their organization's workflows"
    ON public.sentinel_workflows FOR DELETE
    USING (tenant_id = auth.uid() OR tenant_id = (auth.jwt() ->> 'organization_id')::UUID);
