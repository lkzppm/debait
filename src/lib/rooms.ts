import { createHash, randomInt } from "node:crypto";
import { customAlphabet, nanoid } from "nanoid";
import { isLocale, type Locale } from "@/i18n/locales";
import { reduce } from "./debate/reducer";
import { isStrictness, type DebateEvent, type DebateEventBody, type DebateState, type RoomFormat, type RoomMeta, type RoomStatus, type Seat } from "./debate/types";
import { DEFAULT_STRICTNESS } from "./debate/scoring";
import { ApiError } from "./http";
import { kv } from "./store";
import { getRoomUsage, roomUsageKey, type UsageByModel } from "./usage";

/** A room as stored: the public part plus its status, mirrored from the log for listings. */
export interface RoomRecord extends RoomMeta {
  status: RoomStatus;
}

interface SeatRecord {
  name: string;
  /** Only the hash of the seat token is kept. */
  tokenHash: string;
}

export const ROOM_TTL = 60 * 60 * 24 * 7;

export const FORMAT_LIMITS = {
  rounds: { min: 1, max: 6, default: 3 },
  charLimit: { min: 200, max: 1200, default: 600 },
  challenges: { min: 0, max: 5, default: 3 },
} as const;

export const MOTION_LIMIT = 160;
export const STANCE_LIMIT = 40;
export const NAME_LIMIT = 24;

// Lowercase letters without i, l and o: easy to read off a projector, and
// never mistaken for a number or a JSON literal by the Redis client.
const ROOM_ALPHABET = "abcdefghjkmnpqrstuvwxyz";
const newRoomId = customAlphabet(ROOM_ALPHABET, 6);
const ROOM_ID = new RegExp(`^[${ROOM_ALPHABET}]{6}$`);

export function normalizeRoomId(raw: string): string | null {
  const id = raw.trim().toLowerCase();
  return ROOM_ID.test(id) ? id : null;
}

const roomKey = (id: string) => `room:${id}`;
const seatsKey = (id: string) => `room:${id}:seats`;
const eventsKey = (id: string) => `room:${id}:events`;
const INDEX = "rooms";

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const clampInt = (value: unknown, limits: { min: number; max: number; default: number }) => {
  const number = Math.round(Number(value));
  return Number.isFinite(number) ? Math.min(limits.max, Math.max(limits.min, number)) : limits.default;
};

export interface CreateRoomInput {
  motion: string;
  stanceA: string;
  stanceB: string;
  locale: Locale;
  rounds?: unknown;
  charLimit?: unknown;
  challenges?: unknown;
  strictness?: unknown;
}

export async function createRoom(input: CreateRoomInput): Promise<RoomRecord> {
  const motion = input.motion.trim().slice(0, MOTION_LIMIT);
  const stances = { a: input.stanceA.trim().slice(0, STANCE_LIMIT), b: input.stanceB.trim().slice(0, STANCE_LIMIT) };
  if (!motion || !stances.a || !stances.b || !isLocale(input.locale)) throw new ApiError("bad_request");

  const format: RoomFormat = {
    rounds: clampInt(input.rounds, FORMAT_LIMITS.rounds),
    charLimit: clampInt(input.charLimit, FORMAT_LIMITS.charLimit),
    challenges: clampInt(input.challenges, FORMAT_LIMITS.challenges),
    strictness: isStrictness(input.strictness) ? input.strictness : DEFAULT_STRICTNESS,
  };

  const store = kv();
  for (let attempt = 0; attempt < 5; attempt++) {
    const id = newRoomId();
    if (await store.exists(roomKey(id))) continue;
    const room: RoomRecord = { id, motion, stances, locale: input.locale, format, createdAt: Date.now(), status: "lobby" };
    await store.set(roomKey(id), room, ROOM_TTL);
    await store.sortedAdd(INDEX, room.createdAt, id);
    return room;
  }
  throw new ApiError("server_error");
}

export async function getRoom(id: string): Promise<RoomRecord | null> {
  const room = await kv().get<RoomRecord>(roomKey(id));
  // Rooms created before the judge had levels (2026-10-06) are read as balanced.
  if (!room) return null;
  const strictness = isStrictness(room.format.strictness) ? room.format.strictness : DEFAULT_STRICTNESS;
  return { ...room, format: { ...room.format, strictness } };
}

export async function roomExists(id: string): Promise<boolean> {
  return kv().exists(roomKey(id));
}

/** The public part of a room record. */
export function toMeta(room: RoomRecord): RoomMeta {
  const { id, motion, stances, locale, format, createdAt } = room;
  return { id, motion, stances, locale, format, createdAt };
}

async function setStatus(room: RoomRecord, status: RoomStatus): Promise<void> {
  await kv().set(roomKey(room.id), { ...room, status }, ROOM_TTL);
}

// ---- The event log ----------------------------------------------------------

/** Events from position `after` on; `seq` is the position in the list. */
export async function getEvents(id: string, after = 0): Promise<DebateEvent[]> {
  const stored = await kv().range<Omit<DebateEvent, "seq">>(eventsKey(id), after);
  return stored.map((event, index) => ({ ...event, seq: after + index }) as DebateEvent);
}

export async function appendEvent(id: string, body: DebateEventBody): Promise<DebateEvent> {
  const store = kv();
  const at = Date.now();
  const length = await store.push(eventsKey(id), { ...body, at });
  if (length === 1) await store.expire(eventsKey(id), ROOM_TTL);
  return { ...body, at, seq: length - 1 } as DebateEvent;
}

export interface LoadedRoom {
  room: RoomRecord;
  events: DebateEvent[];
  state: DebateState;
}

export async function loadRoom(id: string): Promise<LoadedRoom | null> {
  const room = await getRoom(id);
  if (!room) return null;
  const events = await getEvents(id);
  return { room, events, state: reduce(room, events) };
}

/** Like `loadRoom`, for handlers that cannot go on without the room. */
export async function requireRoom(rawId: string): Promise<LoadedRoom> {
  const id = normalizeRoomId(rawId);
  const loaded = id ? await loadRoom(id) : null;
  if (!loaded) throw new ApiError("not_found");
  return loaded;
}

// ---- Seats ------------------------------------------------------------------

export async function joinRoom(rawId: string, seat: Seat, rawName: string): Promise<{ seat: Seat; token: string }> {
  const { room, state } = await requireRoom(rawId);
  const name = rawName.trim().replace(/\s+/g, " ").slice(0, NAME_LIMIT);
  if (!name) throw new ApiError("bad_request");
  if (state.status !== "lobby") throw new ApiError("not_in_lobby");

  const store = kv();
  const token = nanoid(32);
  const record: SeatRecord = { name, tokenHash: hashToken(token) };
  // Atomic: of two people tapping the same side, exactly one gets it.
  if (!(await store.hashSetIfAbsent(seatsKey(room.id), seat, record))) throw new ApiError("seat_taken");
  await store.expire(seatsKey(room.id), ROOM_TTL);
  await appendEvent(room.id, { type: "room.joined", seat, name });

  const seats = await store.hashAll<SeatRecord>(seatsKey(room.id));
  if (seats.a && seats.b && (await store.setIfAbsent(`room:${room.id}:start`, "1", ROOM_TTL))) {
    // Deb flips a coin for who opens; the log keeps the result, so every screen shows the same one.
    await appendEvent(room.id, { type: "room.started", opener: randomInt(2) === 0 ? "a" : "b" });
    await setStatus(room, "live");
  }
  return { seat, token };
}

/** Which seat this token holds, if any. */
export async function seatOf(id: string, token: string): Promise<Seat | null> {
  if (!token) return null;
  const seats = await kv().hashAll<SeatRecord>(seatsKey(id));
  const hash = hashToken(token);
  if (seats.a?.tokenHash === hash) return "a";
  if (seats.b?.tokenHash === hash) return "b";
  return null;
}

// ---- Typing -------------------------------------------------------------------
// Who is typing is presence, not debate state: it lives outside the event log,
// in a key per seat that expires by itself a few seconds after the last keystroke.

const typingKey = (id: string, seat: Seat) => `room:${id}:typing:${seat}`;
/** How long a typing mark lasts after the last ping from the browser. */
export const TYPING_TTL = 4;

/** A debater is writing: marks their seat for a few seconds. Unknown tokens are ignored. */
export async function markTyping(rawId: string, token: string): Promise<void> {
  const id = normalizeRoomId(rawId);
  if (!id) throw new ApiError("not_found");
  const seat = await seatOf(id, token);
  if (!seat) throw new ApiError("forbidden");
  await kv().set(typingKey(id, seat), 1, TYPING_TTL);
}

/** The message went out: the seat is no longer typing. */
export async function clearTyping(id: string, seat: Seat): Promise<void> {
  await kv().del(typingKey(id, seat));
}

/** The seats typing right now. */
export async function getTyping(id: string): Promise<Seat[]> {
  const [a, b] = await Promise.all([kv().exists(typingKey(id, "a")), kv().exists(typingKey(id, "b"))]);
  return [...(a ? (["a"] as const) : []), ...(b ? (["b"] as const) : [])];
}

// ---- Ending and removing ----------------------------------------------------

export async function finishRoom(room: RoomRecord, reason: "completed" | "stopped"): Promise<boolean> {
  if (!(await kv().setIfAbsent(`room:${room.id}:finish`, reason, ROOM_TTL))) return false;
  await appendEvent(room.id, { type: "room.finished", reason });
  await setStatus(room, "finished");
  return true;
}

export async function stopRoom(rawId: string): Promise<void> {
  const { room, state } = await requireRoom(rawId);
  if (state.status !== "finished") await finishRoom(room, "stopped");
}

export async function deleteRoom(rawId: string): Promise<void> {
  const id = normalizeRoomId(rawId);
  if (!id) throw new ApiError("not_found");
  const store = kv();
  await store.del(roomKey(id), seatsKey(id), eventsKey(id), roomUsageKey(id), `room:${id}:start`, `room:${id}:finish`);
  await store.sortedRemove(INDEX, id);
}

// ---- Listing, for the admin panel ---------------------------------------------

export interface RoomSummary extends RoomRecord {
  names: Partial<Record<Seat, string>>;
  messages: number;
  share: number;
  usage: UsageByModel;
}

export async function listRooms(): Promise<RoomSummary[]> {
  const store = kv();
  const ids = await store.sortedList(INDEX);
  const summaries = await Promise.all(
    ids.map(async (id): Promise<RoomSummary | null> => {
      const loaded = await loadRoom(id);
      if (!loaded) {
        // The room expired; drop it from the index.
        await store.sortedRemove(INDEX, id);
        return null;
      }
      const { room, state } = loaded;
      return {
        ...room,
        status: state.status,
        names: { a: state.seats.a?.name, b: state.seats.b?.name },
        messages: state.messages.length,
        share: state.share,
        usage: await getRoomUsage(id),
      };
    }),
  );
  return summaries.filter((summary): summary is RoomSummary => summary !== null);
}
