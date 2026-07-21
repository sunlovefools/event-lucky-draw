"use client";

import React from "react";
import { useFormStatus } from "react-dom";

type PendingSubmitButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  pendingLabel?: React.ReactNode;
};

export function PendingSubmitButton({
  children,
  pendingLabel = "Working…",
  className,
  disabled,
  ...props
}: PendingSubmitButtonProps) {
  const { pending } = useFormStatus();
  const isDisabled = disabled || pending;

  return (
    <button
      {...props}
      type="submit"
      className={`${className ?? ""}${pending ? " is-pending" : ""}`.trim()}
      disabled={isDisabled}
      aria-busy={pending}
    >
      {pending ? (
        <>
          <span className="btn-spinner" aria-hidden="true" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}
