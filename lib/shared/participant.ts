export type ParticipantNameParts = {
  title?: string | null;
  fullName: string;
};

export function formatParticipantName({ title, fullName }: ParticipantNameParts) {
  return [title?.trim(), fullName.trim()].filter(Boolean).join(" ");
}
