import { useQuery } from "@tanstack/react-query";
import { parsApi } from "../../lib/resources";
import { useDebouncedValue } from "../../lib/useDebouncedValue";
import type { Par } from "../../types/api";

export type ParLookupStatus = "empty" | "checking" | "found" | "unknown" | "error";

export interface ParLookup {
  status: ParLookupStatus;
  /** The PAR with exactly this code (any letter case), once found. */
  par: Par | null;
  /** Near matches, offered when the code isn't found. */
  similar: Par[];
}

export const parCodeKey = (code: string) => ["pars", "code", code.trim().toUpperCase()] as const;

/**
 * Resolves a typed PAR code the way the paper is read: exact code, any
 * letter case. While the operator is still typing it reports "checking", so
 * the field never flashes "No PAR with this code yet" mid-word.
 */
export function useParLookup(code: string): ParLookup {
  const trimmed = code.trim();
  const debounced = useDebouncedValue(trimmed, 250);

  const exact = useQuery({
    queryKey: parCodeKey(debounced),
    queryFn: () => parsApi.list({ code: debounced, pageSize: 1 }),
    enabled: debounced.length > 0,
    staleTime: 30_000,
  });
  const found = exact.data?.data[0] ?? null;

  const similarQuery = useQuery({
    queryKey: ["pars", "similar", debounced.toUpperCase()],
    queryFn: () => parsApi.list({ search: debounced, pageSize: 4, sortBy: "createdAt" }),
    enabled: debounced.length >= 3 && exact.isSuccess && !found,
    staleTime: 30_000,
  });

  if (!trimmed) return { status: "empty", par: null, similar: [] };
  // The debounced code is compared case-blind: retyping "par" as "PAR"
  // shouldn't send the field back to "checking" for the same PAR.
  if (debounced.toUpperCase() !== trimmed.toUpperCase() || exact.isPending) return { status: "checking", par: null, similar: [] };
  if (exact.isError) return { status: "error", par: null, similar: [] };
  if (found) return { status: "found", par: found, similar: [] };
  return { status: "unknown", par: null, similar: similarQuery.data?.data ?? [] };
}
