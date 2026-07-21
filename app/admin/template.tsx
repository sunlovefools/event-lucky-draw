// Re-mounts on every admin navigation so page content gets the same fade
// transition behavior as the delegate route.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}