import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const jsonResponse = (status: number, body: Record<string, unknown>) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey =
  Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing Supabase environment variables.");
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    const { data, error } = await adminClient.rpc("cleanup_retracted_messages", {
      p_limit: 500,
    });
    if (error) {
      return jsonResponse(500, { error: error.message });
    }
    return jsonResponse(200, { deleted: data ?? 0 });
  } catch (error) {
    console.error("Cleanup failed", error);
    return jsonResponse(500, { error: "Cleanup failed" });
  }
});
