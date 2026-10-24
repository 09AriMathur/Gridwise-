// Only file that calls your backend.
// Every component imports from here, so the base URL lives in one place.

const BASE_URL = "http://127.0.0.1:8000/api";

export async function getForecast(zone) {
  const url = zone ? `${BASE_URL}/forecast?zone=${zone}` : `${BASE_URL}/forecast`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Forecast request failed: ${res.status}`);
  return res.json();
}

export async function getSchedule(task) {
  const res = await fetch(`${BASE_URL}/schedule`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(task),
  });
  if (!res.ok) throw new Error(`Schedule request failed: ${res.status}`);
  return res.json();
}

export async function getDevices() {
  const res = await fetch(`${BASE_URL}/devices`);
  if (!res.ok) throw new Error(`Devices request failed: ${res.status}`);
  return res.json();
}
