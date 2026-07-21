export function adminErrorMessage(error?: string): string | undefined {
  if (error === "invalid-login") return "Invalid username or password.";
  if (error === "login-required") return "Admin login required.";
  if (error === "station-invalid") return "Station name is required.";
  if (error === "vendor-invalid") return "Vendor account needs a username, password, and exactly one station.";
  if (error === "draw-invalid") return "Draw label is required and at least one eligible delegate must be available.";
  if (error === "delegate-invalid") return "That delegate could not be updated.";
  return undefined;
}
