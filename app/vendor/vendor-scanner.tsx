"use client";

import React, { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { LoadingOverlay } from "@/app/components/loading-overlay";

type ScanResult =
  | { ok: true; duplicate: boolean; message: string }
  | { ok: false; reason: "not-registered" | "invalid" | "closed" | "unauthorized" | "error"; error: string };

type Mode = "camera" | "manual";

const READER_ID = "vendor-qr-reader";

type ScannerLike = {
  start: (cameraIdOrConfig: unknown, config: unknown, successCallback: (decoded: string) => void, errorCallback?: (error: unknown) => void) => Promise<void>;
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

function ResultBanner({ result }: { result: ScanResult }) {
  let cls = "alert-danger";
  let label = "Couldn't stamp";
  if (result.ok) {
    if (result.duplicate) {
      cls = "alert-info";
      label = "Already collected";
    } else {
      cls = "alert-success";
      label = "Stamped!";
    }
  } else if (result.reason === "not-registered") {
    cls = "alert-info";
    label = "Not registered";
  }

  return (
    <div className={`alert ${cls}`} role="alert" aria-live="polite">
      <strong>{label}.</strong> {result.ok ? result.message : result.error}
    </div>
  );
}

export function VendorScanner({ participationOpen }: { participationOpen: boolean }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [mode, setMode] = useState<Mode>("camera");
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [overlayMessage, setOverlayMessage] = useState<string | undefined>();
  const overlayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      /* already stopped or never started */
    }
  }, []);

  const reset = useCallback(() => {
    void stopCamera();
    setCameraActive(false);
    setCameraStarted(false);
    setScanError(null);
    setResult(null);
    scanInFlightRef.current = false;
    hideOverlay();
    setMode("camera");
  }, [stopCamera, hideOverlay]);

  const handlePayload = useCallback(
    async (payload: string) => {
      const trimmed = payload.trim();
      if (!trimmed || scanInFlightRef.current) return;
      scanInFlightRef.current = true;
      setBusy(true);
      setScanError(null);
      showOverlay("Stamping delegate…");

      // Paint the transparent loader before releasing the camera or calling the
      // scan API, so lower-end phones do not look frozen after a QR is captured.
      await new Promise<void>((resolve) => {
        if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
          setTimeout(resolve, 0);
          return;
        }
        window.requestAnimationFrame(() => resolve());
      });

      const stopCameraPromise = stopCamera();
      try {
        const res = await fetch("/vendor/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ badgePayload: trimmed }),
        });
        const data = (await res.json()) as ScanResult;
        await stopCameraPromise;
        hideOverlay();
        setResult(data);
        if (data.ok) {
          // Refresh the server tree in a transition so the success message paints
          // immediately; the scan-history list catches up without blocking input.
          startTransition(() => router.refresh());
        }
      } catch {
        await stopCameraPromise;
        hideOverlay();
        setResult({ ok: false, reason: "error", error: "Couldn't reach the server. Try again." });
      } finally {
        setBusy(false);
      }
    },
    [router, stopCamera, showOverlay, hideOverlay, startTransition],
  );

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
      try {
        scanner.stop().catch(() => {});
      } catch {
        /* scanner was never started */
      }
      try {
        scanner.clear();
      } catch {
        /* nothing to clear */
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
          (decoded: string) => {
            void handlePayload(decoded);
          },
          () => {
            /* ignore per-frame decode errors */
          },
        );
        started = true;
        setCameraStarted(true);
        if (cancelled) {
          safeStop();
          return;
        }
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
      if (started) safeStop();
      setCameraStarted(false);
    };
  }, [mode, cameraActive, handlePayload]);

  if (!participationOpen) {
    return <div className="alert alert-danger">Participation is closed, so stamps can&apos;t be collected.</div>;
  }

  if (result) {
    return (
      <div className="stack">
        <ResultBanner result={result} />
        <button type="button" className="btn btn-primary btn-block" onClick={reset}>
          Scan next delegate
        </button>
      </div>
    );
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
    </div>
  );
}
