"use client";

import { useEffect, useState } from "react";
import type { DebateEvent } from "./debate/types";

export type Connection = "connecting" | "open" | "reconnecting" | "gone";

interface RoomEvents {
  events: DebateEvent[];
  /** The replay of past events is over; what is on screen is current. */
  ready: boolean;
  connection: Connection;
}

/**
 * Follows a room's event log over Server-Sent Events. The stream starts
 * from the first event, so history and live updates take the same path, and
 * EventSource resumes from the last event it saw whenever the connection
 * drops or the server recycles it.
 */
export function useRoomEvents(roomId: string): RoomEvents {
  const [state, setState] = useState<RoomEvents>({ events: [], ready: false, connection: "connecting" });

  useEffect(() => {
    const source = new EventSource(`/api/rooms/${roomId}/events`);

    source.onopen = () => setState((previous) => ({ ...previous, connection: "open" }));

    source.onmessage = (message) => {
      let event: DebateEvent;
      try {
        event = JSON.parse(message.data) as DebateEvent;
      } catch {
        return;
      }
      // The log is append-only: accept exactly the next event, ignore repeats.
      setState((previous) =>
        event.seq === previous.events.length ? { ...previous, events: [...previous.events, event] } : previous,
      );
    };

    source.addEventListener("ready", () => setState((previous) => ({ ...previous, ready: true })));

    source.addEventListener("gone", () => {
      source.close();
      setState((previous) => ({ ...previous, ready: true, connection: "gone" }));
    });

    source.onerror = () => {
      // CLOSED means the browser gave up (the room is gone); otherwise it is retrying.
      const gone = source.readyState === EventSource.CLOSED;
      setState((previous) => ({ ...previous, ready: previous.ready || gone, connection: gone ? "gone" : "reconnecting" }));
    };

    return () => source.close();
  }, [roomId]);

  return state;
}
