"use client";

import { useEffect, useRef, useState } from "react";
import { reorderStationsAction } from "@/app/admin/actions";
import {
  IconArrowUpDown,
  IconChevronDown,
  IconChevronUp,
  IconGripVertical,
  IconStore,
  IconX,
} from "@/app/admin/icons";
import { PendingSubmitButton } from "@/app/admin/pending-submit-button";

type ReorderStationItem = {
  id: string;
  name: string;
  active: boolean;
  displayOrder?: number;
};

type ReorderStationsModalProps = {
  activeStations: ReorderStationItem[];
  redirectTo: string;
};

export function ReorderStationsModal({
  activeStations = [],
  redirectTo,
}: ReorderStationsModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dragSourceId = useRef<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const [orderedStations, setOrderedStations] = useState<ReorderStationItem[]>(() => {
    return [...activeStations]
      .filter((station) => station.active)
      .sort(
        (a, b) =>
          (a.displayOrder ?? Number.MAX_SAFE_INTEGER) -
            (b.displayOrder ?? Number.MAX_SAFE_INTEGER) ||
          a.name.localeCompare(b.name),
      );
  });

  useEffect(() => {
    const sorted = [...activeStations]
      .filter((station) => station.active)
      .sort(
        (a, b) =>
          (a.displayOrder ?? Number.MAX_SAFE_INTEGER) -
            (b.displayOrder ?? Number.MAX_SAFE_INTEGER) ||
          a.name.localeCompare(b.name),
      );
    setOrderedStations(sorted);
  }, [activeStations]);

  const openModal = () => {
    if (dialogRef.current) {
      if (typeof dialogRef.current.showModal === "function") {
        if (!dialogRef.current.open) {
          dialogRef.current.showModal();
        }
      } else {
        dialogRef.current.setAttribute("open", "");
      }
    }
  };

  const closeModal = () => {
    if (dialogRef.current) {
      if (typeof dialogRef.current.close === "function") {
        dialogRef.current.close();
      } else {
        dialogRef.current.removeAttribute("open");
      }
    }
  };

  function moveItem(index: number, direction: "up" | "down") {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= orderedStations.length) return;

    setOrderedStations((prev) => {
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  }

  function handleDragStart(itemId: string, event: React.DragEvent) {
    dragSourceId.current = itemId;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", itemId);
  }

  function handleDragOver(itemId: string, event: React.DragEvent) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (dragOverId !== itemId) {
      setDragOverId(itemId);
    }
  }

  function handleDrop(targetId: string, event: React.DragEvent) {
    event.preventDefault();
    setDragOverId(null);
    if (!dragSourceId.current || dragSourceId.current === targetId) {
      dragSourceId.current = null;
      return;
    }

    setOrderedStations((current) => {
      const next = [...current];
      const fromIndex = next.findIndex((item) => item.id === dragSourceId.current);
      const toIndex = next.findIndex((item) => item.id === targetId);
      if (fromIndex === -1 || toIndex === -1) {
        return current;
      }
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });

    dragSourceId.current = null;
  }

  function handleDragEnd() {
    dragSourceId.current = null;
    setDragOverId(null);
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-secondary station-reorder-trigger"
        onClick={openModal}
        aria-label="Changing Vendor Position"
        title="Reorder vendor position"
      >
        <IconArrowUpDown size={17} />
        <span>Change Vendor Position</span>
      </button>

      <dialog
        ref={dialogRef}
        className="station-order-dialog"
        aria-labelledby="station-order-title"
      >
        <div className="station-order-dialog__header">
          <span className="station-order-dialog__icon" aria-hidden="true">
            <IconStore size={22} />
          </span>
          <div>
            <p className="eyebrow">Vendor ordering</p>
            <h2 id="station-order-title">Changing Vendor Position</h2>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={closeModal}
            aria-label="Close position dialog"
          >
            <IconX size={18} />
          </button>
        </div>

        <p className="station-order-dialog__intro">
          Drag the active booths or use the arrows to set the order they appear from top to bottom for vendors and participants.
        </p>

        <form action={reorderStationsAction} className="station-order-dialog__form">
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <input
            type="hidden"
            name="stationOrder"
            value={JSON.stringify(orderedStations.map((item) => item.id))}
          />

          {orderedStations.length === 0 ? (
            <div className="station-order-empty">
              <p className="muted">No active exhibition stations to reorder.</p>
            </div>
          ) : (
            <div className="station-order-list" aria-label="Active booths in order">
              {orderedStations.map((item, index) => {
                const isDragging = dragSourceId.current === item.id;
                const isOver = dragOverId === item.id;

                return (
                  <div
                    key={item.id}
                    className={`station-order-item ${isDragging ? "is-dragging" : ""} ${isOver ? "is-drag-over" : ""}`}
                    draggable
                    onDragStart={(event) => handleDragStart(item.id, event)}
                    onDragOver={(event) => handleDragOver(item.id, event)}
                    onDragLeave={() => {
                      if (dragOverId === item.id) setDragOverId(null);
                    }}
                    onDrop={(event) => handleDrop(item.id, event)}
                    onDragEnd={handleDragEnd}
                  >
                    <div className="station-order-item__left">
                      <span className="station-order-item__handle" aria-hidden="true" title="Drag to reorder">
                        <IconGripVertical size={16} />
                      </span>
                      <span className="station-order-item__index">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="station-order-item__name">{item.name}</span>
                    </div>

                    <div className="station-order-item__actions">
                      <button
                        type="button"
                        className="station-order-item__arrow-btn"
                        onClick={() => moveItem(index, "up")}
                        disabled={index === 0}
                        aria-label={`Move ${item.name} up`}
                        title="Move up"
                      >
                        <IconChevronUp size={15} />
                      </button>
                      <button
                        type="button"
                        className="station-order-item__arrow-btn"
                        onClick={() => moveItem(index, "down")}
                        disabled={index === orderedStations.length - 1}
                        aria-label={`Move ${item.name} down`}
                        title="Move down"
                      >
                        <IconChevronDown size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="station-order-dialog__actions">
            <button type="button" className="btn btn-ghost" onClick={closeModal}>
              Cancel
            </button>
            <PendingSubmitButton className="btn btn-primary" pendingLabel="Saving…">
              Save vendor order
            </PendingSubmitButton>
          </div>
        </form>
      </dialog>
    </>
  );
}
