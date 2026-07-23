// Friendly, human-readable messages for the `?error=` codes used across routes.
// Pages previously rendered the raw code string (e.g. "registration-closed"),
// which was confusing to delegates. Centralizing the mapping keeps copy consistent.

const ERROR_MESSAGES: Record<string, string> = {
  // Delegate home
  "registration-closed": "Registration is closed. Please see an event organizer for help.",
  "delegate-invalid": "We couldn't find that badge. Check the QR or registration number and try again.",
  "delegate-not-found": "We couldn't find that badge. Please contact admin to create your account.",
  "survey-invalid": "Your survey couldn't be submitted. Please try again.",

  // Admin
  "invalid-login": "Incorrect username or password.",
  "login-required": "Please log in to continue.",
  "station-invalid": "That station could not be saved. Check the name and try again.",
  "vendor-invalid": "That station login could not be saved. Check the details and try again.",
  "participant-invalid": "That participant could not be saved. Check the ID and name, then try again.",
  "participants-import-invalid": "Participants could not be imported. Check the spreadsheet and try again.",
  "draw-invalid": "The draw couldn't be run. Try again in a moment.",

  // Station login
  "participation-closed": "Participation is closed, so new QR codes can't be generated.",
};

export function friendlyError(code: string | undefined | null): string | null {
  if (!code) return null;
  // Known `?error=` codes map to friendly copy. Anything else (e.g. a full
  // sentence already returned by a server action) is passed through unchanged.
  return ERROR_MESSAGES[code] ?? code;
}
