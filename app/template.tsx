// Re-mounts on every navigation, giving each page a smooth fade + rise
// entrance. CSS-only (see `.page-enter` in globals.css); respects
// prefers-reduced-motion automatically.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
