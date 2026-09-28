import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { mrApi } from "../../lib/resources";
import { useDebouncedValue } from "../../lib/useDebouncedValue";

/**
 * The MR number input shared by the Issue and Transfer forms, with the next
 * free number filled in. The suggestion keeps following the server until
 * the operator types their own: the cached number shown on open can already
 * be taken (another operator, another tab), and the refetch that corrects it
 * lands a moment later. Once they have typed a number, a one-click link
 * brings the free one back.
 *
 * A typed number is checked against every MR on file as it's typed, any
 * letter case (context doc 7: uniqueness is flagged while typing, not on
 * submit).
 */
export function useMrNumber() {
  const [value, setValue] = useState("");
  const [edited, setEdited] = useState(false);
  const query = useQuery({ queryKey: ["mr", "next-number"], queryFn: mrApi.nextNumber, staleTime: 0 });
  const suggested = query.data?.data.mrNumber;

  useEffect(() => {
    if (suggested && !edited) setValue(suggested);
  }, [suggested, edited]);

  const trimmed = value.trim();
  const debounced = useDebouncedValue(trimmed, 300);
  const check = useQuery({
    queryKey: ["mr", "number-check", debounced.toUpperCase()],
    queryFn: () => mrApi.list({ search: debounced, pageSize: 10 }),
    enabled: edited && debounced.length > 0,
    staleTime: 10_000,
  });
  const settled = debounced.toUpperCase() === trimmed.toUpperCase();
  const takenBy =
    edited && trimmed && settled ? (check.data?.data.find((mr) => mr.mr_number.toUpperCase() === trimmed.toUpperCase()) ?? null) : null;

  return {
    value,
    suggested,
    edited,
    /** The MR that already has the typed number, once the check is back. */
    takenBy,
    /** A typed number is waiting on its check. */
    checking: edited && !!trimmed && (!settled || check.isLoading),
    set: (next: string) => {
      setEdited(true);
      setValue(next);
    },
    useSuggested: () => {
      setEdited(false);
      if (suggested) setValue(suggested);
    },
    /** After a duplicate-number refusal: fetch a fresh suggestion. */
    refresh: () => query.refetch(),
  };
}
