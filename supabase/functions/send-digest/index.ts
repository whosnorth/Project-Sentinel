// @ts-nocheck
// Follow this setup guide to integrate the Deno runtime into your application:
// https://deno.land/manual/examples/deploy_node_server

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface UserPreference {
    user_id: string
    weekly_digest: boolean
    monthly_digest: boolean
    email_notifications: boolean
}

Deno.serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // 1. Initialize Supabase Client (Service Role for Admin Access)
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 2. Identify Digest Type based on Request or Schedule
        // In production, you'd pass ?type=weekly or ?type=monthly via the Cron Payload
        const { type } = await req.json() as { type: 'weekly' | 'monthly' }

        if (!['weekly', 'monthly'].includes(type)) {
            throw new Error("Invalid digest type. Must be 'weekly' or 'monthly'.")
        }

        // 3. Fetch Users who opted in
        const column = type === 'weekly' ? 'weekly_digest' : 'monthly_digest'
        const { data: subscribers, error: prefError } = await supabaseClient
            .from('user_preferences')
            .select('user_id')
            .eq(column, true)
            .eq('email_notifications', true)

        if (prefError) throw prefError

        const results = []

        // 4. Loop and "Send" (Simulation)
        for (const sub of subscribers) {
            // Get User Email
            const { data: userData, error: userError } = await supabaseClient.auth.admin.getUserById(sub.user_id)

            if (userError || !userData.user.email) {
                console.error(`Skipping user ${sub.user_id}: Email not found`)
                continue
            }

            // Generate Content (Mocking the Logic from the Artifact)
            const emailContent = `
        <h1>${type === 'weekly' ? '🛡️ Weekly Sentinel Intelligence Pulse' : '📋 Monthly Geopolitical Summary'}</h1>
        <p>Dear System Steward,</p>
        <p>Here is your automated snapshot for ${new Date().toLocaleDateString()}.</p>
        <p><strong>Global Status:</strong> 🟢 SECURE</p>
        <br/>
        <a href="https://sentinel.app/dashboard">Open Console</a>
      `

            // Send Email (Using Resend or similar - MOCKED HERE)
            console.log(`[SIMULATION] Sending ${type} digest to ${userData.user.email}...`)

            // Actual Code would be:
            /*
            const res = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                from: 'Sentinel <no-reply@sentinel.com>',
                to: userData.user.email,
                subject: `${type === 'weekly' ? 'Weekly' : 'Monthly'} Digest`,
                html: emailContent
              })
            })
            */

            results.push({ email: userData.user.email, status: 'queued' })
        }

        return new Response(
            JSON.stringify({ success: true, processed: results.length, details: results }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            }
        )

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            }
        )
    }
})
