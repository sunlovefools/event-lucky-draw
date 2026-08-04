import Link from "next/link";

import { IconArrowRight, IconStamp } from "@/app/admin/icons";
import { FINAL_SURVEY_STATION_NAME } from "@/lib/shared/station";

export function FinalSurveyStationLink({ stationName = FINAL_SURVEY_STATION_NAME }: { stationName?: string }) {
  const stationHref = `/station/${encodeURIComponent(stationName)}`;

  return (
    <section className="final-station-callout" aria-labelledby="final-station-title">
      <span className="final-station-callout__icon" aria-hidden="true">
        <IconStamp size={22} />
      </span>
      <div className="final-station-callout__copy">
        <p className="eyebrow">System final station</p>
        <h2 id="final-station-title">{FINAL_SURVEY_STATION_NAME}</h2>
        <p>Always available and unlocked for participants only after every exhibition stamp is collected.</p>
      </div>
      <div className="final-station-callout__meta">
        <span className="badge badge-success"><span className="station-status-dot" aria-hidden="true" />Always active</span>
        <span className="badge badge-neutral">Protected</span>
      </div>
      <Link href={stationHref} className="btn btn-accent final-station-callout__link" target="_blank" rel="noreferrer">
        Open final station
        <IconArrowRight size={17} />
      </Link>
    </section>
  );
}
