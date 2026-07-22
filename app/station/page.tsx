import Link from "next/link";

export default function StationIndexPage() {
  return (
    <main className="shell" id="main">
      <section className="hero" aria-labelledby="station-link-title">
        <p className="eyebrow">Exhibition station</p>
        <h1 id="station-link-title">Open your station link</h1>
        <p className="lead">Use the station-specific link from the admin station directory to stamp delegates.</p>
        <Link href="/" className="btn btn-primary">Back to event home</Link>
      </section>
    </main>
  );
}
