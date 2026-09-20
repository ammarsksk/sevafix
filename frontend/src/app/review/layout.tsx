import type { ReactNode } from "react";

import { ReviewerShell } from "@/components/reviewer-shell";

export default function ReviewLayout({ children }: { children: ReactNode }) {
  return <ReviewerShell>{children}</ReviewerShell>;
}
