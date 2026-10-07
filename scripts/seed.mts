/**
 * Seeds a running dev server with a debate between two mock people, so the
 * room can be looked at without typing both sides by hand:
 *
 *   pnpm seed                      # against http://localhost:3000
 *   pnpm seed --port 3003          # another port
 *   pnpm seed --locale en          # English motion and messages
 *   pnpm seed --full               # play every round, so the result screen shows
 *
 * It signs in with the admin password (ADMIN_PASSWORD, or "admin" in
 * development), creates the room, seats Ana and Bia, posts their arguments
 * in turn, has Bia call @deb about Ana's first claim, and prints the link
 * plus a line to paste in the browser console to act as either debater.
 * By default it stops with two rounds left, so the room is still live.
 */

const args = process.argv.slice(2);
const option = (name: string) => {
  const at = args.indexOf(`--${name}`);
  return at === -1 ? undefined : args[at + 1];
};
const port = option("port") ?? "3000";
const locale = option("locale") === "en" ? "en" : "pt";
const full = args.includes("--full");
const base = `http://localhost:${port}`;
const password = process.env.ADMIN_PASSWORD ?? "admin";

const SCRIPT = {
  pt: {
    motion: "Home office é melhor que presencial",
    stances: { a: "A favor", b: "Contra" },
    names: { a: "Ana", b: "Bia" },
    messages: [
      "Home office aumenta a produtividade: um estudo de Stanford mediu 13% a mais nos funcionários remotos, com menos pausas e menos dias de licença.",
      "Só preguiçoso defende isso. No escritório a equipe aprende junto e os juniores evoluem muito mais rápido.",
      "Ninguém negou o valor da mentoria. Mas ela cabe em dois dias presenciais por semana; o resto do tempo o deslocamento só rouba horas de trabalho e de vida.",
      "Se todo mundo puder ficar em casa, amanhã ninguém vai mais ao escritório, depois acabam as reuniões, e no fim a empresa some. Presencial é o padrão por um motivo.",
      "O modelo híbrido já é a norma em empresas que medem resultado: a Microsoft e o Google mantêm dois ou três dias presenciais e não perderam produtividade.",
      "Se é tão bom, por que a Amazon mandou todo mundo voltar cinco dias por semana? Quem conhece o negócio sabe que presença conta.",
    ],
    ask: "esse estudo de Stanford com 13% existe mesmo?",
  },
  en: {
    motion: "Remote work beats the office",
    stances: { a: "For", b: "Against" },
    names: { a: "Ana", b: "Bia" },
    messages: [
      "Remote work raises productivity: a Stanford study measured 13% more output from remote employees, with fewer breaks and fewer sick days.",
      "Only lazy people defend that. In the office the team learns together and juniors grow much faster.",
      "Nobody denied the value of mentoring. But it fits in two office days a week; the rest of the time the commute only steals hours of work and of life.",
      "If everyone can stay home, tomorrow nobody goes to the office, then meetings end, and in the end the company disappears. In person is the default for a reason.",
      "Hybrid is already the norm at companies that measure results: Microsoft and Google keep two or three office days and lost no productivity.",
      "If it is so good, why did Amazon order everyone back five days a week? People who know the business know presence counts.",
    ],
    ask: "does that Stanford study with 13% really exist?",
  },
}[locale];

let cookie = "";

async function call<T = unknown>(path: string, body?: unknown, method = body === undefined ? "GET" : "POST"): Promise<T> {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { "Content-Type": "application/json", cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  const data = (await response.json().catch(() => null)) as T & { error?: string };
  if (!response.ok) throw new Error(`${method} ${path} → ${response.status} ${data?.error ?? ""}`);
  return data;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  await call("/api/admin/login", { password });
  const { id } = await call<{ id: string }>("/api/admin/rooms", {
    motion: SCRIPT.motion,
    stanceA: SCRIPT.stances.a,
    stanceB: SCRIPT.stances.b,
    locale,
    rounds: 3,
    challenges: 3,
    charLimit: 600,
  });
  console.log(`room ${id}`);

  const seats = {
    a: await call<{ seat: "a"; token: string }>(`/api/rooms/${id}/join`, { seat: "a", name: SCRIPT.names.a }),
    b: await call<{ seat: "b"; token: string }>(`/api/rooms/${id}/join`, { seat: "b", name: SCRIPT.names.b }),
  };
  console.log(`seated ${SCRIPT.names.a} and ${SCRIPT.names.b}`);

  // Two rounds, or all three with --full. A pause after each message lets the
  // mock judge finish, so the turns and the ledger arrive in order.
  const count = full ? SCRIPT.messages.length : SCRIPT.messages.length - 2;
  let firstMessageId = "";
  for (let index = 0; index < count; index++) {
    const seat = index % 2 === 0 ? "a" : "b";
    const message = await call<{ id: string }>(`/api/rooms/${id}/messages`, { token: seats[seat].token, text: SCRIPT.messages[index] });
    if (index === 0) firstMessageId = message.id;
    console.log(`${SCRIPT.names[seat]}: ${SCRIPT.messages[index].slice(0, 60)}…`);
    await sleep(1500);
    if (index === 1) {
      await call(`/api/rooms/${id}/mention`, { token: seats.b.token, text: `@deb ${SCRIPT.ask}`, replyTo: firstMessageId });
      console.log(`${SCRIPT.names.b} called @deb about ${SCRIPT.names.a}'s first message`);
      await sleep(2500);
    }
  }

  const identity = (seat: "a" | "b") =>
    `localStorage.setItem(${JSON.stringify(`debait.seat.${id}`)}, ${JSON.stringify(JSON.stringify({ seat, token: seats[seat].token, name: SCRIPT.names[seat] }))}); location.reload()`;

  console.log(`\nopen   ${base}/r/${id}`);
  console.log(`\nTo act as a debater, paste in the browser console on that page:`);
  console.log(`  as ${SCRIPT.names.a}:  ${identity("a")}`);
  console.log(`  as ${SCRIPT.names.b}:  ${identity("b")}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  console.error(`Is the dev server running on ${base}? Pass --port to change it.`);
  process.exit(1);
});
