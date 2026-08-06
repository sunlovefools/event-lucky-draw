"use client";

import { useEffect, useRef, useState } from "react";

import {
  createParticipantAction,
  importParticipantsAction,
  setDelegateDrawStatusAction,
  setDelegateStationStampAction,
  updateDelegateNameAction,
} from "@/app/admin/actions";
import { DeleteAllDelegatesButton } from "@/app/admin/delete-all-delegates-button";
import { IconCheck, IconChevronDown, IconPencil, IconPlus, IconStamp, IconUpload, IconX } from "@/app/admin/icons";
import { PendingSubmitButton } from "@/app/admin/pending-submit-button";
import type { AdminParticipant } from "@/lib/admin/participants";
import type { Station } from "@/lib/shared/station";

type ModalKind = "include" | "disqualify" | "stamps" | "rename" | null;
const ACTION_MENU_OPEN = "participant-action-menu-open";

function Modal({
  dialogRef,
  title,
  children,
  onClose,
}: {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <dialog ref={dialogRef} className="participant-dialog" aria-labelledby={`${title.toLowerCase().replace(/\s+/g, "-")}-title`} onClose={onClose}>
      <div className="participant-dialog__header">
        <h2 id={`${title.toLowerCase().replace(/\s+/g, "-")}-title`}>{title}</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close dialog"><IconX size={18} /></button>
      </div>
      {children}
    </dialog>
  );
}

export function ParticipantManagementActions({ delegateCount, redirectTo }: { delegateCount: number; redirectTo: string }) {
  const importDialogRef = useRef<HTMLDialogElement>(null);
  const addDialogRef = useRef<HTMLDialogElement>(null);

  return (
    <div className="participant-action-bar" aria-label="Participant actions">
      <button type="button" className="btn participant-action-button participant-action-button--import" onClick={() => importDialogRef.current?.showModal()}>
        <IconUpload size={18} /> Import Excel
      </button>
      <button type="button" className="btn participant-action-button" onClick={() => addDialogRef.current?.showModal()}>
        <IconPlus size={18} /> Add participant
      </button>
      <DeleteAllDelegatesButton delegateCount={delegateCount} redirectTo={redirectTo} />

      <Modal dialogRef={importDialogRef} title="Import participants" onClose={() => importDialogRef.current?.close()}>
        <p className="participant-dialog__intro">Upload an Excel file using Delegate ID, Title, and Name from the first worksheet.</p>
        <form action={importParticipantsAction} className="participant-dialog__form">
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <div className="field">
            <label className="field-label" htmlFor="participantFile">Excel file</label>
            <input id="participantFile" name="participantFile" className="input" type="file" accept=".xls,.xlsx" required />
            <p className="hint">Existing Delegate IDs are updated in place. Maximum file size: 5 MB.</p>
          </div>
          <div className="participant-dialog__actions"><button type="button" className="btn btn-ghost" onClick={() => importDialogRef.current?.close()}>Cancel</button><PendingSubmitButton className="btn btn-primary" pendingLabel="Importing…"><IconUpload size={17} /> Import participants</PendingSubmitButton></div>
        </form>
      </Modal>

      <Modal dialogRef={addDialogRef} title="Add participant" onClose={() => addDialogRef.current?.close()}>
        <p className="participant-dialog__intro">Create a participant account, or update one with the same Delegate ID.</p>
        <form action={createParticipantAction} className="participant-dialog__form participant-dialog__form--grid">
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <div className="field"><label className="field-label" htmlFor="participant-registration-number">Delegate ID</label><input id="participant-registration-number" name="registrationNumber" className="input" placeholder="e.g. DLGTxxxx" required /></div>
          <div className="field"><label className="field-label" htmlFor="participant-title">Title</label><input id="participant-title" name="title" className="input" placeholder="e.g. Dr" /></div>
          <div className="field participant-dialog__full-width"><label className="field-label" htmlFor="participant-full-name">Name</label><input id="participant-full-name" name="fullName" className="input" placeholder="Jane Doe" required /></div>
          <div className="participant-dialog__actions participant-dialog__full-width"><button type="button" className="btn btn-ghost" onClick={() => addDialogRef.current?.close()}>Cancel</button><PendingSubmitButton className="btn btn-primary" pendingLabel="Saving…"><IconPlus size={17} /> Save participant</PendingSubmitButton></div>
        </form>
      </Modal>
    </div>
  );
}

export function ParticipantActions({ participant, stations, redirectTo }: { participant: AdminParticipant; stations: Station[]; redirectTo: string }) {
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState<ModalKind>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const menuId = `participant-actions-${participant.id}`;
  const displayName = `${participant.title ? `${participant.title} ` : ""}${participant.fullName}`;
  const isManuallyIncluded = participant.drawStatus === "manual_include" || participant.drawStatus === "eligible";
  const isDisqualified = participant.drawStatus === "disqualified" || participant.drawStatus === "excluded";
  const canChangeDrawStatus = participant.drawStatus !== "winner";
  const isRemovingInclusion = modal === "include" && isManuallyIncluded;
  const isRemovingDisqualification = modal === "disqualify" && isDisqualified;

  useEffect(() => {
    const closeOtherMenus = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== menuId) setOpen(false);
    };
    window.addEventListener(ACTION_MENU_OPEN, closeOtherMenus);
    return () => window.removeEventListener(ACTION_MENU_OPEN, closeOtherMenus);
  }, [menuId]);

  function toggleMenu() {
    setOpen((wasOpen) => {
      const nextOpen = !wasOpen;
      if (nextOpen) window.dispatchEvent(new CustomEvent(ACTION_MENU_OPEN, { detail: menuId }));
      return nextOpen;
    });
  }

  function showModal(kind: Exclude<ModalKind, null>) {
    setOpen(false);
    setModal(kind);
    requestAnimationFrame(() => dialogRef.current?.showModal());
  }

  function closeModal() {
    dialogRef.current?.close();
    setModal(null);
  }

  const modalTitle = modal === "include"
    ? (isRemovingInclusion ? "Remove manual inclusion" : "Include in draw")
    : modal === "disqualify"
      ? (isRemovingDisqualification ? "Remove disqualification" : "Disqualify participant")
      : modal === "stamps" ? "Manage station stamps" : "Rename participant";

  return <div className="participant-actions">
    <details className="action-menu" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary aria-label={`Show actions for ${displayName}`} onClick={(event) => { event.preventDefault(); toggleMenu(); }}>Actions <IconChevronDown size={15} /></summary>
      <div className="action-menu-panel">
        {canChangeDrawStatus && <button type="button" className="action-menu-item" onClick={() => showModal("include")}><IconCheck size={16} /> {isManuallyIncluded ? "Remove manual inclusion" : "Include in draw"}</button>}
        {canChangeDrawStatus && <button type="button" className={`action-menu-item ${isDisqualified ? "" : "action-menu-item--danger"}`} onClick={() => showModal("disqualify")}><IconX size={16} /> {isDisqualified ? "Remove disqualification" : "Disqualify"}</button>}
        <button type="button" className="action-menu-item" onClick={() => showModal("stamps")}><IconStamp size={16} /> Manage stamps</button>
        <button type="button" className="action-menu-item" onClick={() => showModal("rename")}><IconPencil size={16} /> Rename</button>
      </div>
    </details>
    {modal && <Modal dialogRef={dialogRef} title={modalTitle} onClose={closeModal}>
      {modal === "include" || modal === "disqualify" ? <form action={setDelegateDrawStatusAction} className="participant-dialog__form">
        <input type="hidden" name="delegateId" value={participant.id} /><input type="hidden" name="drawStatus" value={modal === "include" ? (isRemovingInclusion ? "auto" : "eligible") : (isRemovingDisqualification ? "auto" : "excluded")} /><input type="hidden" name="redirectTo" value={redirectTo} />
        <p className="participant-dialog__intro">{modal === "include" ? (isRemovingInclusion ? `${displayName} will return to automatic draw eligibility.` : `${displayName} will be manually included in the lucky draw.`) : (isRemovingDisqualification ? `${displayName} will return to automatic draw eligibility.` : `${displayName} will no longer be eligible for the lucky draw.`)}</p>
        <div className="participant-dialog__actions"><button type="button" className="btn btn-ghost" onClick={closeModal}>Cancel</button><PendingSubmitButton className={`btn ${modal === "disqualify" && !isRemovingDisqualification ? "btn-danger" : "btn-primary"}`} pendingLabel="Saving…">{modal === "include" ? (isRemovingInclusion ? "Remove manual inclusion" : "Include in draw") : (isRemovingDisqualification ? "Remove disqualification" : "Disqualify")}</PendingSubmitButton></div>
      </form> : null}
      {modal === "stamps" && <div className="stamp-list stamp-list--dialog">{stations.length === 0 ? <p className="stamp-panel__empty">No stations have been created.</p> : stations.map((station) => {
        const stamped = participant.stampedStationIds?.includes(station.id) ?? false;
        return <form action={setDelegateStationStampAction} className="stamp-row" key={station.id}><input type="hidden" name="delegateId" value={participant.id} /><input type="hidden" name="stationId" value={station.id} /><input type="hidden" name="stamped" value={String(!stamped)} /><input type="hidden" name="redirectTo" value={redirectTo} /><span className="stamp-row__station"><span className={`stamp-row__state ${stamped ? "is-stamped" : ""}`} aria-hidden="true">{stamped ? <IconCheck size={14} /> : null}</span><span><strong>{station.name}</strong>{!station.active && <small>Inactive station</small>}</span></span><PendingSubmitButton className={`stamp-row__button ${stamped ? "is-remove" : "is-add"}`} pendingLabel={stamped ? "Removing…" : "Stamping…"}>{stamped ? "Unstamp" : "Stamp"}</PendingSubmitButton></form>;
      })}</div>}
      {modal === "rename" && <form action={updateDelegateNameAction} className="participant-dialog__form"><input type="hidden" name="delegateId" value={participant.id} /><input type="hidden" name="redirectTo" value={redirectTo} /><div className="field"><label className="field-label" htmlFor={`rename-${participant.id}`}>Full name</label><input id={`rename-${participant.id}`} name="fullName" className="input" defaultValue={participant.fullName} required /></div><div className="participant-dialog__actions"><button type="button" className="btn btn-ghost" onClick={closeModal}>Cancel</button><PendingSubmitButton className="btn btn-primary" pendingLabel="Saving…">Save name</PendingSubmitButton></div></form>}
    </Modal>}
  </div>;
}
