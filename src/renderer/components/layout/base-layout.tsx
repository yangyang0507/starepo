import React from "react";
import { DragWindowRegion } from "@/components/drag-window-region";

export default function BaseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <DragWindowRegion />
      <main className="h-screen">{children}</main>
    </>
  );
}
