import React from "react";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "../../routes/router";
import { AuthProvider } from "../../contexts/auth-context";
import { AuthState } from "../../services/github/types";

interface MainAppProps {
  authState: AuthState;
  children?: React.ReactNode;
}

export default function MainApp({ authState, children }: MainAppProps) {
  return (
    <AuthProvider>
      <div className="bg-background h-screen">
        <div data-auth-state={JSON.stringify(authState)}>
          <RouterProvider router={router} />
          {children}
        </div>
      </div>
    </AuthProvider>
  );
}
