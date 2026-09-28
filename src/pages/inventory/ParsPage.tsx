import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { parsApi, type SortDir } from "../../lib/resources";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { EmptyState, ErrorState } from "../../components/ui/EmptyState";
import { Pagination } from "../../components/ui/Pagination";
import { SortableTh } from "../../components/ui/SortableTh";
import { TableSkeleton } from "../../components/ui/TableSkeleton";
import { PageHeader } from "../../components/ui/PageHeader";
import { SearchInput } from "../../components/ui/SearchInput";
import { useToast } from "../../components/ui/toastContext";
import { ChevronRightIcon, PlusIcon, ReceiptIcon } from "../../components/ui/icons";
import { formatCalendarDate } from "../../lib/format";
import { formatPeso } from "../../lib/inventory";
import { useDebouncedValue } from "../../lib/useDebouncedValue";
import type { Par } from "../../types/api";
import { ParFormModal, type RegisterMode } from "./ParFormModal";
import { ParDetailModal } from "./ParDetailModal";
import { RegisterItemsModal } from "./RegisterItemsModal";
import { ItemDetailModal } from "./ItemDetailModal";

type ParSort = "dateReceived" | "parCode";
const PAGE_SIZE = 20;

/**
 * PARs (context doc v2, 10.1): one row per purchase delivery. Searching by
 * code, supplier or reference is how an operator finds "the Bacolod Tech
 * delivery" when a box turns up without its paper.
 */
export function ParsPage() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<ParSort>("dateReceived");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);
  const [showNew, setShowNew] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const [register, setRegister] = useState<{ mode: RegisterMode; par: Par } | null>(null);
  const [itemId, setItemId] = useState<number | null>(null);

  const debounced = useDebouncedValue(search.trim());
  const params = { search: debounced || undefined, sortBy, sortDir, page, pageSize: PAGE_SIZE };
  const listQuery = useQuery({
    queryKey: ["pars", "list", params],
    queryFn: () => parsApi.list(params),
    placeholderData: keepPreviousData,
  });
  const allQuery = useQuery({ queryKey: ["pars", "list", { pageSize: 1 }], queryFn: () => parsApi.list({ pageSize: 1 }) });
  const rows = listQuery.data?.data ?? [];
  const total = allQuery.data?.total;

  function toggleSort(field: ParSort) {
    if (field === sortBy) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(field);
      setSortDir(field === "dateReceived" ? "desc" : "asc");
    }
    setPage(0);
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="PARs"
        description={
          total != null
            ? `${total} purchase deliver${total === 1 ? "y" : "ies"} on record. Every item registered from a delivery links to its PAR.`
            : "Purchase deliveries, one per paper PAR."
        }
        actions={
          <Button onClick={() => setShowNew(true)}>
            <PlusIcon size={15} />
            New PAR
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(0);
          }}
          placeholder="Search PAR code, supplier, reference…"
          shortcut
          className="min-w-56 flex-1 sm:max-w-md"
        />
      </div>

      <Card className="overflow-hidden">
        {listQuery.isLoading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : listQuery.isError ? (
          <ErrorState message={(listQuery.error as Error).message} />
        ) : rows.length > 0 ? (
          <div className={clsx("transition-opacity", listQuery.isPlaceholderData && "opacity-60")}>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[color:var(--gridline)] bg-black/[0.015] text-xs text-ink-muted dark:bg-white/[0.02]">
                    <SortableTh field="parCode" activeField={sortBy} dir={sortDir} onSort={toggleSort}>
                      PAR code
                    </SortableTh>
                    <SortableTh field="dateReceived" activeField={sortBy} dir={sortDir} onSort={toggleSort}>
                      Date received
                    </SortableTh>
                    <th className="px-4 py-3 font-medium">Supplier</th>
                    <th className="hidden px-4 py-3 font-medium lg:table-cell">PO / reference</th>
                    <th className="px-4 py-3 text-right font-medium">Amount</th>
                    <th className="px-4 py-3 text-right font-medium">Items</th>
                    <th className="w-10 px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((par) => (
                    <tr
                      key={par.id}
                      tabIndex={0}
                      onClick={() => setOpenId(par.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setOpenId(par.id);
                        }
                      }}
                      className="cursor-pointer border-b border-[color:var(--gridline)] last:border-0 hover:bg-black/[0.02] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-series-1 dark:hover:bg-white/[0.03]"
                    >
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2 font-mono text-[13px] font-semibold text-ink">
                          <ReceiptIcon size={14} className="text-ink-muted" />
                          {par.par_code}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-ink-secondary tabular-nums">{formatCalendarDate(par.date_received)}</td>
                      <td className="max-w-[16rem] truncate px-4 py-3 text-ink">{par.supplier || <span className="text-ink-muted">None</span>}</td>
                      <td className="hidden px-4 py-3 font-mono text-xs text-ink-secondary lg:table-cell">{par.reference_no || <span className="font-sans text-ink-muted">None</span>}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap text-ink tabular-nums">{formatPeso(par.amount) ?? <span className="text-ink-muted">None</span>}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {par.itemCount ? (
                          <span className="rounded-full bg-series-1/10 px-2 py-0.5 text-xs font-semibold text-series-1">{par.itemCount}</span>
                        ) : (
                          <span className="text-xs text-ink-muted">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <ChevronRightIcon size={15} className="text-ink-muted" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-[color:var(--gridline)] md:hidden">
              {rows.map((par) => (
                <li key={par.id}>
                  <button type="button" onClick={() => setOpenId(par.id)} className="flex w-full flex-col gap-1 px-4 py-3.5 text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-mono text-sm font-semibold text-ink">{par.par_code}</span>
                      <span className="text-xs text-ink-muted">
                        {par.itemCount ?? 0} item{par.itemCount === 1 ? "" : "s"}
                      </span>
                    </span>
                    <span className="truncate text-sm text-ink-secondary">{par.supplier || "No supplier"}</span>
                    <span className="text-xs text-ink-muted">
                      {formatCalendarDate(par.date_received)}
                      {formatPeso(par.amount) ? ` · ${formatPeso(par.amount)}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : debounced ? (
          <EmptyState title="No PARs match" hint="Try the code as printed, the supplier, or the PO number." />
        ) : (
          <EmptyState
            icon={ReceiptIcon}
            title="No PARs yet"
            hint="Record a delivery's PAR, then register what came in it."
            action={
              <Button onClick={() => setShowNew(true)}>
                <PlusIcon size={15} />
                New PAR
              </Button>
            }
          />
        )}
      </Card>

      {listQuery.data && listQuery.data.total > PAGE_SIZE ? (
        <Pagination page={page} pageSize={PAGE_SIZE} total={listQuery.data.total} onPageChange={setPage} itemLabel="PARs" />
      ) : null}

      {showNew ? (
        <ParFormModal
          onClose={() => setShowNew(false)}
          onRegister={(par, mode) => {
            setShowNew(false);
            setRegister({ mode, par });
          }}
        />
      ) : null}
      {openId != null ? <ParDetailModal id={openId} onClose={() => setOpenId(null)} onOpenItem={setItemId} /> : null}
      {register ? (
        <RegisterItemsModal
          initialMode={register.mode}
          initialPar={register.par}
          onClose={() => setRegister(null)}
          onOpenItem={setItemId}
          onRegistered={(items) =>
            toast({ title: `${items.length} item${items.length === 1 ? "" : "s"} registered`, description: `Under ${register.par.par_code}` })
          }
        />
      ) : null}
      {itemId != null ? <ItemDetailModal id={itemId} onClose={() => setItemId(null)} /> : null}
    </div>
  );
}
