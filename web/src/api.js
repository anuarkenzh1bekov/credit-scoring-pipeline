const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

async function request(path, options) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
  } catch {
    throw new Error("API is unreachable. Start the backend on " + BASE);
  }
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") detail = body.detail;
      else if (Array.isArray(body.detail)) detail = body.detail.map((d) => `${d.loc.at(-1)}: ${d.msg}`).join("; ");
    } catch {}
    throw new Error(detail);
  }
  return res.json();
}

export const getModelInfo = () => request("/model/info");
export const getApplications = (decision) =>
  request(`/applications?limit=50${decision ? `&decision=${decision}` : ""}`);
export const score = (payload) =>
  request("/score", { method: "POST", body: JSON.stringify(payload) });
