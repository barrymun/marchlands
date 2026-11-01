// The server's clock as this device sees it. Countdowns and landing times (camp times, docs/features/camp-times.md)
// follow the server, not a device clock that may be a few seconds out: the push socket sends the server's time when it
// connects and with every pong (lib/push/handlers.ts), and the difference is kept here.

let offset = 0;

/** Note a time the server sent, taken as the time it arrived (the push socket's connect and pong). */
export function noteServerTime(serverTime: number, receivedAt = Date.now()) {
  offset = serverTime - receivedAt;
}

/** How far the server's clock is ahead of this device's (negative when behind), in ms; 0 until the server has said. */
export const clockOffset = () => offset;
