"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { useT } from "@/i18n/LocaleProvider";
import { Pill } from "./pill";

/** Copies `value` and confirms for a moment. */
export function CopyButton({ value, label }: { value: string; label?: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked (insecure origin): the link is still visible to copy by hand.
    }
  };
  return (
    <Pill type="button" variant="outline" size="sm" onClick={copy}>
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? t.common.copied : (label ?? t.common.copy)}
    </Pill>
  );
}
