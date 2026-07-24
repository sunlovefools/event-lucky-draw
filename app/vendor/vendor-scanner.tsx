"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

import { LoadingOverlay } from "@/app/components/loading-overlay";
import type { StationScanHistoryEntry } from "@/lib/vendor/portal";

type ScanResult =
  | {
      ok: true;
      duplicate: boolean;
      message: string;
      historyEntry?: StationScanHistoryEntry;
    }
  | {
      ok: false;
      reason: "not-registered" | "invalid" | "closed" | "locked" | "unauthorized" | "error";
      error: string;
    };

type Mode = "camera" | "manual";

const READER_ID = "vendor-qr-reader";

type ScannerLike = {
  start: (cameraIdOrConfig: unknown, config: unknown, successCallback: (decoded: string) => void, errorCallback?: (error: unknown) => void) => Promise<void>;
  pause: (shouldPauseVideo?: boolean) => void;
  resume: () => void;
  stop: () => Promise<void>;
  clear: () => void;
};

function describeCameraError(err: unknown): string {
  const name = (err as { name?: string } | null)?.name;
  if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") {
    return "Camera permission denied. Allow camera access, or use “Type code instead”.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError" || name === "DevicesNotFoundError") {
    return "No camera found. Use “Type code instead” to enter the code.";
  }
  return "Camera unavailable. Use “Type code instead” to enter the code.";
}

function resultHeading(result: ScanResult) {
  if (result.ok) return result.duplicate ? "Already collected" : "Stamped!";
  if (result.reason === "not-registered") return "Not registered";
  if (result.reason === "locked") return "Station locked";
  return "Couldn't stamp";
}

function ScanResultDialog({ result, onContinue }: { result: ScanResult; onContinue: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const heading = resultHeading(result);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }

    return () => {
      if (typeof dialog.close === "function" && dialog.open) dialog.close();
      else dialog.removeAttribute("open");
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className={`scan-result-dialog ${result.ok ? "scan-result-dialog--success" : "scan-result-dialog--error"}`}
      aria-labelledby="scan-result-title"
      aria-describedby="scan-result-message"
      onCancel={(event) => {
        event.preventDefault();
        onContinue();
      }}
    >
      <div className="scan-result-card">
        <span className="scan-result-icon" aria-hidden="true">
          {result.ok ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="m5 12 4 4L19 6" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          )}
        </span>
        <h2 id="scan-result-title">{heading}</h2>
        <p id="scan-result-message">{result.ok ? result.message : result.error}</p>
        <button type="button" className="btn btn-primary btn-block" autoFocus onClick={onContinue}>
          Continue
        </button>
      </div>
    </dialog>
  );
}

function playScanFeedback(success: boolean) {
  try {
    navigator.vibrate?.(success ? [70] : [45, 50, 45]);
  } catch {
    // Feedback is optional and unsupported on some browsers.
  }

  try {
    const AudioContextConstructor = window.AudioContext
      ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) return;
    const audioContext = new AudioContextConstructor();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.frequency.value = success ? 880 : 220;
    gain.gain.setValueAtTime(0.05, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.12);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.12);
    oscillator.addEventListener("ended", () => void audioContext.close(), { once: true });
  } catch {
    // Audio feedback is best-effort only.
  }
}

export function VendorScanner({
  participationOpen,
  stationName,
  onHistoryEntry,
}: {
  participationOpen: boolean;
  stationName: string;
  onHistoryEntry?: (entry: StationScanHistoryEntry) => void;
}) {
  const [mode, setMode] = useState<Mode>("camera");
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [cameraCycle, setCameraCycle] = useState(0);
  const [scanError, setScanError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [overlayMessage, setOverlayMessage] = useState<string | undefined>();
  const overlayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manualFormRef = useRef<HTMLFormElement>(null);
  const scannerRef = useRef<ScannerLike | null>(null);
  const scanInFlightRef = useRef(false);

  const showOverlay = useCallback((message?: string) => {
    if (overlayTimer.current) clearTimeout(overlayTimer.current);
    setOverlayMessage(message);
    setOverlayVisible(true);
    overlayTimer.current = setTimeout(() => setOverlayVisible(false), 6000);
  }, []);

  const hideOverlay = useCallback(() => {
    if (overlayTimer.current) clearTimeout(overlayTimer.current);
    overlayTimer.current = null;
    setOverlayVisible(false);
  }, []);

  useEffect(() => () => {
    if (overlayTimer.current) clearTimeout(overlayTimer.current);
  }, []);

  const stopCamera = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (!scanner) return;
    try {
      await scanner.stop();
      scanner.clear();
    } catch {
      // The camera may already be stopped or may not have finished starting.
    }
  }, []);

  const restartCamera = useCallback(() => {
    setCameraStarted(false);
    setCameraCycle((cycle) => cycle + 1);
  }, []);

  const handlePayload = useCallback(
    async (payload: string) => {
      const trimmed = payload.trim();
      if (!trimmed || scanInFlightRef.current) return;
      scanInFlightRef.current = true;
      setBusy(true);
      setScanError(null);
      showOverlay("Stamping delegate…");

      // Give the loader one paint before pausing video and starting the request.
      await new Promise<void>((resolve) => {
        if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
          setTimeout(resolve, 0);
          return;
        }
        window.requestAnimationFrame(() => resolve());
      });

      try {
        scannerRef.current?.pause(true);
      } catch {
        // Manual entry and a camera that has just stopped do not need pausing.
      }

      try {
        const res = await fetch("/station/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ badgePayload: trimmed, stationName }),
        });
        const data = (await res.json()) as ScanResult;
        hideOverlay();
        setResult(data);
        if (data.ok && !data.duplicate && data.historyEntry) {
          onHistoryEntry?.(data.historyEntry);
        }
        playScanFeedback(data.ok);
      } catch {
        hideOverlay();
        const failure: ScanResult = { ok: false, reason: "error", error: "Couldn't reach the server. Try again." };
        setResult(failure);
        playScanFeedback(false);
      } finally {
        setBusy(false);
      }
    },
    [hideOverlay, onHistoryEntry, showOverlay, stationName],
  );

  const continueScanning = useCallback(() => {
    setResult(null);
    setBusy(false);
    scanInFlightRef.current = false;
    hideOverlay();

    if (mode === "manual") {
      manualFormRef.current?.reset();
      window.requestAnimationFrame(() => manualFormRef.current?.querySelector<HTMLInputElement>("input")?.focus());
      return;
    }

    window.requestAnimationFrame(() => {
      try {
        const scanner = scannerRef.current;
        if (!scanner) throw new Error("Scanner is unavailable");
        scanner.resume();
      } catch {
        restartCamera();
      }
    });
  }, [hideOverlay, mode, restartCamera]);

  const openManual = useCallback(() => {
    void stopCamera();
    setCameraActive(false);
    setCameraStarted(false);
    setScanError(null);
    setMode("manual");
  }, [stopCamera]);

  useEffect(() => {
    if (mode !== "camera" || !cameraActive) return;
    let cancelled = false;
    let scanner: ScannerLike | null = null;
    let started = false;

    const safeStop = () => {
      if (!scanner) return;
      if (scannerRef.current === scanner) scannerRef.current = null;
      try {
        scanner.stop().catch(() => {});
      } catch {
        // The scanner may not have started.
      }
      try {
        scanner.clear();
      } catch {
        // Nothing to clear.
      }
    };

    (async () => {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        if (!cancelled) {
          setCameraActive(false);
          setCameraStarted(false);
          setScanError("Camera needs a secure connection (https:// or http://localhost). Use “Type code instead”.");
        }
        return;
      }
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;
        scanner = new Html5Qrcode(READER_ID) as unknown as ScannerLike;
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decoded: string) => void handlePayload(decoded),
          () => {
            // Per-frame decode misses are expected.
          },
        );
        started = true;
        if (cancelled) {
          safeStop();
          return;
        }
        setCameraStarted(true);
      } catch (err) {
        if (!cancelled) {
          setCameraActive(false);
          setCameraStarted(false);
          setScanError(describeCameraError(err));
        }
      }
    })();

    return () => {
      cancelled = true;
      if (started || scanner) safeStop();
      setCameraStarted(false);
    };
  }, [cameraActive, cameraCycle, handlePayload, mode]);

  if (!participationOpen) {
    return <div className="alert alert-danger">Participation is closed, so stamps can&apos;t be collected.</div>;
  }

  return (
    <div className="register-scan">
      {mode === "camera" ? (
        <>
          <p className="lead">Scan The Delegate&apos;s Conference Badge QR</p>

          {!cameraActive ? (
            <div className="camera-idle">
              <div className="badge-illustration" aria-hidden="true">
                <div className="badge-illustration__badge">
                  <span className="badge-illustration__ribbon" />
                  <div className="badge-illustration__card">
                    <img className="badge-illustration__image" src="/badge-image.png" alt="" />
                    <span className="badge-illustration__glow" />
                    <span className="badge-illustration__beam" />
                  </div>
                  <span className="badge-illustration__success" />
                </div>
              </div>
              <button type="button" className="btn btn-primary btn-block camera-allow" onClick={() => setCameraActive(true)}>
                <svg className="camera-allow__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2Z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                Allow camera access
              </button>
            </div>
          ) : (
            <>
              <div className="qr-reader-wrap">
                <div id={READER_ID} className={`qr-reader${cameraStarted ? " camera-enter" : ""}`} />
              </div>
              {!cameraStarted ? (
                <p className="camera-requesting" aria-live="polite">
                  <span className="camera-requesting__spinner" aria-hidden="true" />
                  Requesting camera permission…
                </p>
              ) : null}
            </>
          )}

          {scanError ? <p className="inline-error" style={{ marginTop: "1rem" }}>{scanError}</p> : null}

          <p className="hint" style={{ marginTop: "1rem" }}>
            <button type="button" className="link-btn" onClick={openManual}>
              Type code instead
            </button>
          </p>
        </>
      ) : (
        <>
          <p className="lead">Type the delegate&apos;s badge code.</p>
          <form
            ref={manualFormRef}
            className="form"
            style={{ marginTop: "1rem" }}
            onSubmit={(event) => {
              event.preventDefault();
              const value = new FormData(event.currentTarget).get("manualCode");
              void handlePayload(typeof value === "string" ? value : "");
            }}
          >
            <div className="field">
              <label className="field-label" htmlFor="vendor-manualCode">Badge code</label>
              <input id="vendor-manualCode" name="manualCode" className="input" autoComplete="off" autoFocus required />
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
              {busy ? "Stamping…" : "Stamp delegate"}
            </button>
          </form>
          <p className="hint" style={{ marginTop: "1rem" }}>
            <button type="button" className="link-btn" onClick={() => setMode("camera")}>
              Scan with camera instead
            </button>
          </p>
        </>
      )}
      <LoadingOverlay show={overlayVisible} message={overlayMessage} variant="translucent" />
      {result ? <ScanResultDialog result={result} onContinue={continueScanning} /> : null}
    </div>
  );
}
