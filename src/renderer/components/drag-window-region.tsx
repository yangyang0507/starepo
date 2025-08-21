import React from "react";

interface DragWindowRegionProps {
  children?: React.ReactNode;
  className?: string;
}

export const DragWindowRegion: React.FC<DragWindowRegionProps> = ({
  children,
  className = "",
}) => {
  return (
    <div
      className={`drag-region ${className}`}
      style={{
        height: "30px",
        backgroundColor: "transparent",
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
      }}
    >
      {children}
    </div>
  );
};
