import { useQuery } from "@tanstack/react-query";
import { custodiansApi } from "../../lib/resources";
import { fullName } from "../../lib/format";
import { useDebouncedValue } from "../../lib/useDebouncedValue";
import type { Custodian } from "../../types/api";

/**
 * Employee numbers are unique once filled in, any letter case (context doc
 * 3.6). This checks a typed one against the custodians on file while it's
 * typed, so a clash shows in the form instead of as a refusal after Save.
 * `excludeId` is the custodian being edited, whose own number doesn't count.
 */
export function useEmployeeNumberCheck(value: string, excludeId?: number) {
  const trimmed = value.trim();
  const debounced = useDebouncedValue(trimmed, 300);
  const query = useQuery({
    queryKey: ["custodians", "employee-number-check", debounced.toUpperCase()],
    queryFn: () => custodiansApi.list({ search: debounced, pageSize: 20 }),
    enabled: debounced.length > 0,
    staleTime: 10_000,
  });
  const settled = debounced.toUpperCase() === trimmed.toUpperCase();
  const takenBy: Custodian | null =
    trimmed && settled
      ? (query.data?.data.find((c) => c.id !== excludeId && c.employee_number?.trim().toUpperCase() === trimmed.toUpperCase()) ?? null)
      : null;
  return {
    takenBy,
    checking: !!trimmed && (!settled || query.isLoading),
    error: takenBy ? `A custodian with this employee number already exists: ${fullName(takenBy)}.` : undefined,
  };
}
