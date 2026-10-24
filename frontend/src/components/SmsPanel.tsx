import { useEffect, useState } from "react";
import { CircleCheck, Loader2, MessageSquare, Send, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "../lib/api";
import { E164, normalizePhone, usePhone } from "../lib/phone";
import type { SmsStatus } from "../lib/types";
import { FieldError, Panel, btnLine, btnSolid, fieldCls, labelCls } from "./common";

/** Text-message reminders: server status, the saved number, and a test text. */
export default function SmsPanel() {
  const { phone: saved, save } = usePhone();
  const [phone, setPhone] = useState(saved);
  const [status, setStatus] = useState<SmsStatus | null>(null);
  const [checkFailed, setCheckFailed] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [sending, setSending] = useState(false);

  useEffect(() => setPhone(saved), [saved]);
  useEffect(() => {
    api.smsStatus().then(setStatus).catch(() => setCheckFailed(true));
  }, []);

  const valid = E164.test(normalizePhone(phone));

  function persist() {
    if (!phone.trim()) { save(""); setError(undefined); return true; }
    if (!valid) { setError("Use international format, e.g. +16175550123."); return false; }
    save(phone); setError(undefined); return true;
  }

  async function test() {
    if (!persist()) return;
    setSending(true);
    try {
      await api.smsTest(normalizePhone(phone));
      toast.success("Test text sent", { description: `Check ${normalizePhone(phone)}.` });
    } catch (e) {
      toast.error("Couldn't send the test text", { description: e instanceof ApiError ? e.message : "The server didn't respond." });
    } finally {
      setSending(false);
    }
  }

  const ready = status?.ready === true;
  return (
    <Panel title="Text Messages" icon={MessageSquare} tone="green" className="animate-rise-in">
      <div className="space-y-4">
        <p className="text-subheadline text-muted-foreground">
          For devices without a smart plug, GridWise texts you when to turn them on and off, even when the app is closed.
        </p>

        <div className={cn("flex items-start gap-2.5 rounded-xl px-3 py-2.5",
          ready ? "bg-success/10" : status || checkFailed ? "bg-warning/10" : "bg-secondary")}>
          {!status && !checkFailed ? <Loader2 className="mt-0.5 size-4 animate-spin text-muted-foreground" aria-hidden="true" />
            : ready ? <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" strokeWidth={2.5} aria-hidden="true" />
            : <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" strokeWidth={2.5} aria-hidden="true" />}
          <div className="text-subheadline min-w-0">
            {!status && !checkFailed && <p className="text-muted-foreground">Checking the server…</p>}
            {checkFailed && <p>Couldn't reach the server to check text messages.</p>}
            {status && ready && <p className="font-medium">Texts are on.</p>}
            {status && !ready && <p className="font-medium">Texts aren't set up on the server yet.</p>}
            {status?.reason && <p className="text-footnote text-muted-foreground">{status.reason}</p>}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <Label htmlFor="sms-phone" className={labelCls}>Your mobile number</Label>
            <Input id="sms-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+16175550123" className={fieldCls}
              value={phone} onChange={(e) => { setPhone(e.target.value); setError(undefined); }} aria-invalid={!!error} />
            <FieldError>{error}</FieldError>
          </div>
          <Button variant="outline" className={cn(btnLine, "h-11 px-4 text-[15px]")}
            onClick={() => { if (persist()) toast.success(phone.trim() ? "Number saved" : "Number removed"); }}>
            Save
          </Button>
          <Button className={cn(btnSolid, "h-11 px-4 text-[15px]")} disabled={!ready || !valid || sending} onClick={test}>
            {sending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
            Send Test Text
          </Button>
        </div>
        <p className="text-footnote text-muted-foreground">
          The number is saved in this browser and sent to the GridWise server only when you schedule a device or send a test.
        </p>
      </div>
    </Panel>
  );
}
