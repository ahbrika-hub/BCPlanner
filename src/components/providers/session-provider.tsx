"use client";

import { createContext, useContext } from "react";
import type { User } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";
import type { SavedView } from "@/lib/data/saved-views";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export type SessionValue = {
  user: User;
  profile: Profile;
  permissions: string[];
  /** The caller's personal saved views (Tasks list), oldest first. */
  savedViews: SavedView[];
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({
  value,
  children,
}: {
  value: SessionValue;
  children: React.ReactNode;
}) {
  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

/** Access the current session (user, profile, permission keys). */
export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return ctx;
}
