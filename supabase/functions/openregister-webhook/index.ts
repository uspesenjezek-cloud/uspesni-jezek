import "jsr:@supabase/functions-js/edge-runtime.d.ts";

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function fromBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function validSignature(raw: string, headers: Headers, secret: string) {
  const id = headers.get("svix-id") || "";
  const timestamp = headers.get("svix-timestamp") || "";
  const signatures = (headers.get("svix-signature") || "").split(/\s+/).filter(Boolean);
  if (!id || !/^\d+$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  try {
    const key = await crypto.subtle.importKey("raw", fromBase64(secret.replace(/^whsec_/, "")), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${timestamp}.${raw}`));
    const expected = btoa(String.fromCharCode(...new Uint8Array(signed)));
    return signatures.some((signature) => signature.replace(/^v1,/, "") === expected);
  } catch (_) { return false; }
}

function eventTimestamp(event: Record<string, any>) {
  for (const value of [event.occurred_at, event.created_at]) {
    const parsed = new Date(String(value || ""));
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
}

function validIsoDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const parsed = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return parsed.toISOString().slice(0, 10) === value;
}

function monitoringWindowAllows(monitor: Record<string, any>, date: string) {
  const schedule = monitor.openregister_payload?.monitoringSchedule;
  if (!schedule) return true;
  const start = String(schedule.monitoringStartDate || "");
  const end = String(schedule.projectEndDate || "");
  if (!validIsoDate(start) || !validIsoDate(end)) return false;
  return date >= start && date <= end;
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return json(405, { ok: false });
  const raw = await request.text();
  const secret = Deno.env.get("OPENREGISTER_WEBHOOK_SECRET") || "";
  if (!secret || !(await validSignature(raw, request.headers, secret))) return json(401, { ok: false });
  let event: Record<string, any>;
  try { event = JSON.parse(raw); } catch (_) { return json(400, { ok: false }); }
  const entityId = String(event.entity_id || event.data?.entity_id || event.entity?.id || event.data?.entity?.id || event.subject?.id || "");
  if (!entityId) return json(200, { ok: true, ignored: true });
  const url = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" };
  const monitorResponse = await fetch(`${url}/rest/v1/boniteta_monitorji?entity_id=eq.${encodeURIComponent(entityId)}&disabled=eq.false&select=*`, { headers });
  if (!monitorResponse.ok) return json(500, { ok: false });
  const monitors = await monitorResponse.json();
  const occurredAt = eventTimestamp(event);
  const occurredOn = occurredAt.slice(0, 10);
  for (const monitor of monitors) {
    if (!monitoringWindowAllows(monitor, occurredOn)) continue;
    const response = await fetch(`${url}/rest/v1/boniteta_opozorila?on_conflict=user_id,external_event_id`, {
      method: "POST", headers: { ...headers, Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify({ user_id: monitor.user_id, profile_id: monitor.profile_id,
        external_event_id: String(event.id || request.headers.get("svix-id")),
        category: String(event.preference || event.category || event.type || "basic").slice(0, 80),
        title: String(event.title || "OpenRegister je zaznal spremembo podjetja").slice(0, 240),
        payload: event, occurred_at: occurredAt }),
    });
    if (!response.ok) return json(500, { ok: false });
  }
  return json(200, { ok: true });
});
