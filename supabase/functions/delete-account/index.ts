import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (status: number, body: Record<string, unknown>) => {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey =
  Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing Supabase environment variables.");
}

const expectedIssuer = supabaseUrl ? `${supabaseUrl}/auth/v1` : "";

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const decodeBase64Url = (value: string) => {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (padded.length % 4)) % 4;
  const normalized = padded + "=".repeat(padLength);
  return atob(normalized);
};

const parseJwtPayload = (jwt: string) => {
  const parts = jwt.split(".");
  if (parts.length !== 3) return null;
  try {
    const payloadJson = decodeBase64Url(parts[1]);
    return JSON.parse(payloadJson) as {
      iss?: string;
      aud?: string | string[];
      exp?: number;
      sub?: string;
    };
  } catch {
    return null;
  }
};

const isJwtValidForProject = (jwt: string) => {
  const payload = parseJwtPayload(jwt);
  if (!payload || !payload.sub) return false;
  if (!expectedIssuer || payload.iss !== expectedIssuer) return false;
  const aud = payload.aud;
  const audList = Array.isArray(aud) ? aud : aud ? [aud] : [];
  if (!audList.includes("authenticated")) return false;
  if (payload.exp && payload.exp * 1000 < Date.now()) return false;
  return true;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, { error: "Server misconfigured" });
  }

  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!authHeader) {
    return jsonResponse(401, { error: "Missing authorization header" });
  }

  let jwt = authHeader.trim();
  if (/^bearer\\s+/i.test(jwt)) {
    jwt = jwt.replace(/^bearer\\s+/i, "").trim();
  } else if (/^bearer/i.test(jwt)) {
    jwt = jwt.replace(/^bearer/i, "").trim();
  }

  if (!jwt) {
    return jsonResponse(401, { error: "Invalid authorization header" });
  }

  if (!isJwtValidForProject(jwt)) {
    return jsonResponse(401, { error: "Invalid token" });
  }

  const { data: authData, error: authError } = await adminClient.auth.getUser(jwt);
  if (authError || !authData?.user) {
    console.warn("delete-account: auth validation failed", {
      error: authError?.message ?? "unknown",
      status: (authError as { status?: number } | null)?.status ?? null,
    });
    return jsonResponse(401, { error: "Invalid token" });
  }

  const userId = authData.user.id;
  const now = new Date().toISOString();

  try {
    const reactionsResult = await adminClient
      .from("message_reactions")
      .delete()
      .eq("user_id", userId);
    if (reactionsResult.error) throw reactionsResult.error;

    const crewPinsResult = await adminClient
      .from("crew_event_pins")
      .delete()
      .eq("user_id", userId);
    if (crewPinsResult.error) throw crewPinsResult.error;

    const userPinsResult = await adminClient
      .from("user_pinned_events")
      .delete()
      .eq("user_id", userId);
    if (userPinsResult.error) throw userPinsResult.error;

    const statusResult = await adminClient
      .from("user_event_statuses")
      .delete()
      .eq("user_id", userId);
    if (statusResult.error) throw statusResult.error;

    const readsResult = await adminClient
      .from("group_reads")
      .delete()
      .eq("user_id", userId);
    if (readsResult.error) throw readsResult.error;

    const membershipsResult = await adminClient
      .from("group_members")
      .delete()
      .eq("user_id", userId);
    if (membershipsResult.error) throw membershipsResult.error;

    const pinnedByResult = await adminClient
      .from("group_pinned_events")
      .update({ pinned_by: null })
      .eq("pinned_by", userId);
    if (pinnedByResult.error) throw pinnedByResult.error;

    const createdByResult = await adminClient
      .from("crew_events")
      .update({ created_by: null })
      .eq("created_by", userId);
    if (createdByResult.error) throw createdByResult.error;

    const messagesResult = await adminClient
      .from("messages")
      .update({
        user_id: null,
        text: "Message deleted",
        retracted_at: now,
        retracted_by: userId,
        message_type: "system",
      })
      .eq("user_id", userId);
    if (messagesResult.error) throw messagesResult.error;

    const deleteGroupsResult = await adminClient
      .from("groups")
      .delete()
      .eq("owner_id", userId);
    if (deleteGroupsResult.error) throw deleteGroupsResult.error;

    const preferencesResult = await adminClient
      .from("user_preferences")
      .delete()
      .eq("user_id", userId);
    if (preferencesResult.error) throw preferencesResult.error;

    const profileResult = await adminClient
      .from("profiles")
      .delete()
      .eq("user_id", userId);
    if (profileResult.error) throw profileResult.error;

    const storageResult = await adminClient.storage
      .from("avatars")
      .list(userId, { limit: 100, offset: 0 });
    if (storageResult.error) throw storageResult.error;
    if (storageResult.data?.length) {
      const removePaths = storageResult.data
        .map((item) => item.name)
        .filter(Boolean)
        .map((name) => `${userId}/${name}`);
      if (removePaths.length) {
        const removeResult = await adminClient.storage.from("avatars").remove(removePaths);
        if (removeResult.error) throw removeResult.error;
      }
    }

    const deleteAuthResult = await adminClient.auth.admin.deleteUser(userId);
    if (deleteAuthResult.error) throw deleteAuthResult.error;

    return jsonResponse(200, { success: true });
  } catch (error) {
    console.error("Delete account failed", error);
    return jsonResponse(500, { error: "Failed to delete account" });
  }
});
