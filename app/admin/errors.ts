export function adminErrorMessage(error?: string): string | undefined {
  if (error === "invalid-login") return "Invalid username or password.";
  if (error === "login-required") return "Admin login required.";
  if (error === "station-invalid") return "Station name is required.";
  if (error === "vendor-invalid") return "Station login needs a username, password, and exactly one exhibition station.";
  if (error === "draw-invalid") return "Draw label is required and at least one eligible delegate must be available.";
  if (error === "draw-settings-invalid") return "Enter a spinning time from 1 to 60 seconds and a name display time from 0.05 to 2 seconds.";
  if (error === "delegate-invalid") return "That delegate could not be updated.";
  return undefined;
}
