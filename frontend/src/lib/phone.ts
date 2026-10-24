import { useCallback, useEffect, useState } from "react";

// The number text reminders go to, remembered in this browser so it's filled in next time.
const KEY = "gridwise.phone.v1";
const EVENT = "gridwise-phone";
export const E164 = /^\+[1-9]\d{7,14}$/;

export const normalizePhone = (raw: string) => raw.replace(/[\s\-().]/g, "");

function read(): string {
  try { return localStorage.getItem(KEY) ?? ""; } catch { return ""; }
}

export function usePhone() {
  const [phone, setPhone] = useState(read);
  useEffect(() => {
    const sync = () => setPhone(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener("storage", sync); };
  }, []);
  const save = useCallback((value: string) => {
    try { localStorage.setItem(KEY, normalizePhone(value)); } catch { /* storage blocked */ }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return { phone, save };
}
