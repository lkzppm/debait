"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/LocaleProvider";

/** Copies `value` and confirms for a moment. */
export function CopyButton({ value, label, size = "sm" }: { value: string; label?: string; size?: "sm" | "default" }) {
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
    <Button type="button" variant="secondary" size={size} onClick={copy}>
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      {copied ? t.common.copied : (label ?? t.common.copy)}
    </Button>
  );
}
