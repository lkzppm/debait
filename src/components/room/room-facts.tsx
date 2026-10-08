"use client";

import { AtSign, Coins, Languages, Repeat, Type } from "lucide-react";
import { LEVEL_FACE } from "@/components/admin/level-picker";
import { Deb } from "@/components/site/deb";
import { DICTIONARIES } from "@/i18n";
import { useT } from "@/i18n/LocaleProvider";
import type { RoomMeta } from "@/lib/debate/types";
import { cn } from "@/lib/utils";

/**
 * A room's rules as small square facts with icons: the coin flip for who
 * opens, rounds, @deb calls, characters, the language Deb writes in, and her
 * level with her face for it. In a row under the lobby's motion, or stacked
 * in the room's info popup.
 */
export function RoomFacts({ meta, stacked = false, className }: { meta: RoomMeta; stacked?: boolean; className?: string }) {
  const t = useT();
  const { format } = meta;
  const facts = [
    { icon: <Coins className="text-side-a" />, text: t.lobby.coin },
    { icon: <Repeat className="text-side-a" />, text: t.lobby.rounds(format.rounds) },
    { icon: <AtSign className="text-side-a" />, text: t.lobby.calls(format.challenges) },
    { icon: <Type className="text-side-a" />, text: t.lobby.chars(format.charLimit) },
    { icon: <Languages className="text-side-a" />, text: `${t.admin.botLanguage}: ${DICTIONARIES[meta.locale].name}` },
    {
      icon: <Deb mood={LEVEL_FACE[format.strictness]} className="text-bot" />,
      text: `${t.admin.strictness}: ${t.strictness[format.strictness].name}`,
      title: t.strictness[format.strictness].hint,
    },
  ];
  return (
    <ul className={cn("flex gap-2 text-sm", stacked ? "flex-col" : "flex-wrap justify-center", className)}>
      {facts.map(({ icon, text, title }) => (
        <li
          key={text}
          title={title}
          className="inline-flex items-center gap-2 border border-border bg-card px-3 py-1.5 text-muted-foreground [&_svg]:size-4 [&_svg]:shrink-0"
        >
          {icon}
          {text}
        </li>
      ))}
    </ul>
  );
}
