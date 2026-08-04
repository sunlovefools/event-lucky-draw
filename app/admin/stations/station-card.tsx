"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { editStationAction } from "@/app/admin/actions";
import { IconPencil, IconStore } from "@/app/admin/icons";
import { PendingSubmitButton } from "@/app/admin/pending-submit-button";

type StationCardProps = {
  station: { id: string; name: string; active: boolean };
  index: number;
  redirectTo: string;
};

export function StationCard({ station, index, redirectTo }: StationCardProps) {
  const [editingName, setEditingName] = useState(false);
  const nameInput = useRef<HTMLInputElement>(null);
  const stationHref = `/station/${encodeURIComponent(station.name)}`;

  useEffect(() => {
    if (editingName) nameInput.current?.focus();
  }, [editingName]);

  return (
    <article className="station-card">
      <div className="station-card__number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</div>
      <form action={editStationAction} className="station-card__form">
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <input type="hidden" name="stationId" value={station.id} />
        <div className="station-card__topline">
          <div className="station-card__identity">
            <span className="station-card__icon" aria-hidden="true"><IconStore size={19} /></span>
            <div>
              <div className="station-card__title-row">
                {editingName ? (
                  <input ref={nameInput} id={`station-${station.id}`} name="name" className="input station-card__title-input" defaultValue={station.name} required aria-label="Exhibition station name" onBlur={() => setEditingName(false)} onKeyDown={(event) => { if (event.key === "Escape") setEditingName(false); }} />
                ) : (
                  <><strong>{station.name}</strong><input type="hidden" name="name" value={station.name} /></>
                )}
                <button type="button" className="icon-btn station-card__edit-name" onClick={() => setEditingName(true)} aria-label={`Edit ${station.name} name`} title="Edit station name"><IconPencil size={15} /></button>
              </div>
              <span>Exhibition station</span>
            </div>
          </div>
          <div className="station-card__badges">
            <span className={`badge ${station.active ? "badge-success" : "badge-neutral"}`}><span className="station-status-dot" aria-hidden="true" />{station.active ? "Active" : "Inactive"}</span>
          </div>
        </div>
        <div className="station-card__controls">
          <label className="station-toggle station-toggle--compact">
            <input type="checkbox" name="active" value="true" defaultChecked={station.active} />
            <span className="station-toggle__track" aria-hidden="true"><span /></span>
            <span><strong>Active</strong><small>{station.active ? "Accepting stamps" : "Currently hidden"}</small></span>
          </label>
          <div className="station-card__actions">
            <PendingSubmitButton className="btn btn-primary station-card__save" pendingLabel="Saving…">Save changes</PendingSubmitButton>
            <Link href={stationHref} className="btn btn-accent station-card__open" target="_blank" rel="noreferrer">Open station page</Link>
          </div>
        </div>
      </form>
    </article>
  );
}
