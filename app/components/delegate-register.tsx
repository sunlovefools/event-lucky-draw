"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

import { LoadingOverlay } from "@/app/components/loading-overlay";
import { identifyDelegateAction } from "@/app/delegate/actions";

type Mode = "camera" | "manual";
type Step = "capture" | "name";

type ScannerLike = {
  start: (cameraIdOrConfig: unknown, config: unknown, successCallback: (decoded: string) => void, errorCallback?: (error: unknown) => void) => Promise<void>;
  stop: () => Promise<void>;
  clear: () => void;
};

const READER_ID = "delegate-qr-reader";

function describeCameraError(err: unknown): string {
  const name = (err as { name?: string } | null)?.name;
  if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") {
    return "Camera permission denied. Allow camera access, or use “Type code instead”.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError" || name === "DevicesNotFoundError") {
    return "No camera found. Use “Type code instead” to enter your code.";
  }
  return "Camera unavailable. Use “Type code instead” to enter your code.";
}

export function DelegateRegister({ errorMessage, pendingStamp }: { errorMessage?: string | null; pendingStamp: boolean }) {
  const [mode, setMode] = useState<Mode>("camera");
  const [step, setStep] = useState<Step>("capture");
  const [code, setCode] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // Full-screen branded loading overlay shown optimistically before a server
  // action that redirects, so the old page never looks frozen.
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [overlayMessage, setOverlayMessage] = useState<string | undefined>();
  const showOverlay = useCallback((message?: string) => {
    setOverlayMessage(message);
    setOverlayVisible(true);
  }, []);
  const hideOverlay = useCallback(() => setOverlayVisible(false), []);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStarted, setCameraStarted] = useState(false);

  // html5-qrcode is browser-only and is created on demand inside an effect.
  const scannerRef = useRef<ScannerLike | null>(null);

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

  const startCamera = useCallback(() => {
    setScanError(null);
    setCameraActive(true);
  }, []);

  const resume = useCallback(async (value: string) => {
    const formData = new FormData();
    formData.set("badgePayload", value);
    formData.set("fullName", "");
    // Server action resumes the existing delegate and redirects into the
    // delegate view. The redirect is handled by the framework.
    await identifyDelegateAction(formData);
  }, []);

  const handleCode = useCallback(
    async (value: string) => {
      const trimmed = value.trim();
      if (!trimmed || checking) return;
      setCode(trimmed);
      setChecking(true);
      setScanError(null);
      showOverlay("Checking your badge…");
      try {
        const res = await fetch(`/api/delegate/exists?registrationNumber=${encodeURIComponent(trimmed)}`);
        const data = (await res.json()) as { registered?: boolean };
        if (data.registered) {
          await stopCamera();
          showOverlay("Setting you up…");
          // Resume redirects and never returns; the loading overlay stays up
          // until the next page mounts and replaces this component.
          await resume(trimmed);
        } else {
          await stopCamera();
          hideOverlay();
          setStep("name");
          setChecking(false);
        }
      } catch {
        // Network failure — fall back to asking for the name; the real
        // identify flow will surface any genuine error.
        await stopCamera();
        hideOverlay();
        setStep("name");
        setChecking(false);
      }
    },
    [resume, stopCamera, checking, showOverlay, hideOverlay],
  );

  // Start the camera only after the user taps "Allow camera access"
  // (cameraActive). That triggers the native permission prompt; the square
  // is revealed once the stream is actually live (cameraStarted).
  useEffect(() => {
    if (mode !== "camera" || step !== "capture" || !cameraActive) return;
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
            void handleCode(decoded);
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
  }, [mode, step, cameraActive, handleCode]);

  const switchToManual = useCallback(() => {
    void stopCamera();
    setCameraActive(false);
    setCameraStarted(false);
    setMode("manual");
    setScanError(null);
  }, [stopCamera]);

  const switchToCamera = useCallback(() => {
    setCameraActive(false);
    setCameraStarted(false);
    setMode("camera");
    setScanError(null);
  }, []);

  const handleManualSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void handleCode(manualCode);
  };

  const handleNameSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (overlayVisible) return;
      const formData = new FormData(event.currentTarget);
      showOverlay("Setting you up…");
      try {
        await identifyDelegateAction(formData);
      } catch {
        // Non-redirect failure (e.g. network) — reveal the form again.
        hideOverlay();
      }
    },
    [overlayVisible, showOverlay, hideOverlay],
  );

  return (
    <section className="card" aria-labelledby="register-title">
      <div className="section-head">
        <h2 id="register-title">Join the lucky draw</h2>
        <span className="badge badge-info">Not registered yet</span>
      </div>

      {pendingStamp ? (
        <p className="alert alert-info" style={{ marginBottom: "1rem" }}>
          Register first, then we'll apply your pending station stamp if the QR is still valid.
        </p>
      ) : null}
      {errorMessage ? <p className="inline-error" role="alert">{errorMessage}</p> : null}

      {step === "capture" ? (
        <div className="register-scan">
          {mode === "camera" ? (
            <>
              <p className="lead">Scan your badge QR</p>

              {!cameraActive ? (
                <div className="camera-idle">
                  <div className="badge-illustration" aria-hidden="true">
                    <span className="badge-illustration__scan" />
                  </div>
                  <button type="button" className="btn btn-primary btn-block camera-allow" onClick={startCamera}>
                    <svg className="camera-allow__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2Z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                    Allow camera access
                  </button>
                </div>
              ) : cameraStarted ? (
                <div className="qr-reader-wrap">
                  <div id={READER_ID} className="qr-reader camera-enter" />
                </div>
              ) : (
                <p className="camera-requesting" aria-live="polite">
                  <span className="camera-requesting__spinner" aria-hidden="true" />
                  Requesting camera permission…
                </p>
              )}

              {scanError ? <p className="inline-error" style={{ marginTop: "1rem" }}>{scanError}</p> : null}

              <p className="hint" style={{ marginTop: "1rem" }}>
                <button type="button" className="link-btn" onClick={switchToManual}>
                  Type code instead
                </button>
              </p>
            </>
          ) : (
            <>
              <p className="lead">Type the code below your badge QR code.</p>
              <form onSubmit={handleManualSubmit} className="form" style={{ marginTop: "1rem" }}>
                <div className="field">
                  <label className="field-label" htmlFor="manualCode">Badge code</label>
                  <input
                    id="manualCode"
                    name="manualCode"
                    className="input"
                    autoComplete="off"
                    autoFocus
                    required
                    value={manualCode}
                    onChange={(event) => setManualCode(event.target.value)}
                    placeholder="e.g. REG-1024"
                  />
                </div>
                <button type="submit" className="btn btn-primary btn-block" disabled={checking || !manualCode.trim()}>
                  {checking ? "Checking…" : "Continue"}
                </button>
              </form>
              <p className="hint" style={{ marginTop: "1rem" }}>
                <button type="button" className="link-btn" onClick={switchToCamera}>
                  Scan with camera instead
                </button>
              </p>
            </>
          )}
        </div>
      ) : (
        <form onSubmit={handleNameSubmit} className="form" style={{ marginTop: "1.25rem" }}>
          <input type="hidden" name="badgePayload" value={code} />
          <p className="lead">Almost there — just tell us who you are.</p>
          <div className="field">
            <label className="field-label" htmlFor="fullName">Full name</label>
            <input id="fullName" name="fullName" className="input" autoComplete="name" placeholder="Jane Doe" required autoFocus />
          </div>
          <button type="submit" className="btn btn-primary btn-block">
            Continue
          </button>
          <p className="hint">
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setStep("capture");
                setCode("");
                setCameraActive(false);
                setCameraStarted(false);
              }}
            >
              Use a different code
            </button>
          </p>
        </form>
      )}
      <LoadingOverlay show={overlayVisible} message={overlayMessage} />
    </section>
  );
}
