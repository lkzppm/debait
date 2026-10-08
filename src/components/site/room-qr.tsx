"use client";

import { QRCodeSVG } from "qrcode.react";
import { Deb } from "./deb";

/** A transparent pixel: the QR code clears its middle for it, and Deb is drawn there instead. */
const BLANK = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
const QR_SIZE = 168;

/**
 * The room's QR code in the side colours, blue fading into red, with Deb in
 * the middle. It always sits on white: phone cameras read dark modules on a
 * light ground far more reliably than the reverse, whatever the theme. The
 * high error-correction level is what lets the middle be cleared for Deb.
 */
export function RoomQr({ link, size = QR_SIZE }: { link: string; size?: number }) {
  return (
    <div className="relative bg-white p-3">
      <svg width="0" height="0" className="absolute" aria-hidden>
        <defs>
          <linearGradient id="room-qr-ink" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" style={{ stopColor: "var(--side-a-deep)" }} />
            <stop offset="1" style={{ stopColor: "var(--side-b-deep)" }} />
          </linearGradient>
        </defs>
      </svg>
      {link ? (
        <>
          <QRCodeSVG
            value={link}
            size={size}
            marginSize={0}
            level="H"
            fgColor="url(#room-qr-ink)"
            bgColor="transparent"
            imageSettings={{ src: BLANK, width: 40, height: 40, excavate: true }}
          />
          <span className="absolute inset-0 grid place-items-center" aria-hidden>
            <Deb sides className="size-7" />
          </span>
        </>
      ) : (
        <div style={{ width: size, height: size }} />
      )}
    </div>
  );
}
