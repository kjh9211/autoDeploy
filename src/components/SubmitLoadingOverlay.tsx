"use client";

import { useFormStatus } from "react-dom";
import { LoadingOverlay } from "./LoadingOverlay";

// Renders as a child of a <form> so useFormStatus picks up that form's
// pending state — works whether the form uses useActionState or a plain
// server action reference.
export function SubmitLoadingOverlay({ label }: { label?: string }) {
  const { pending } = useFormStatus();
  return <LoadingOverlay show={pending} label={label} />;
}
