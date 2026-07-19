"use client";

import React, { useState } from "react";
import { QRCodeSVG } from "qrcode.react";

export function QrDisplay({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard may be unavailable; ignore */
    }
  }

  return (
    <div className="qr">
      <div className="qr-card">
        <QRCodeSVG value={value} size={240} level="M" includeMargin aria-label={label ?? "Station QR code"} />
      </div>
      <span className="qr-link">{value}</span>
      <button type="button" className="copy-btn" onClick={copy}>
        {copied ? "Copied!" : "Copy link"}
      </button>
    </div>
  );
}
