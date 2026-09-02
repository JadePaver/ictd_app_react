import { Button } from "./Button";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";

/** Shared pagination footer for list pages — "Showing X–Y of Z" plus
 * previous/next controls. Renders nothing when everything fits on one page. */
export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  itemLabel = "items",
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  itemLabel?: string;
}) {
  if (total <= pageSize) return null;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);

  return (
    <div className="flex flex-col gap-2 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between">
      <span>
        Showing {from}–{to} of {total} {itemLabel}
      </span>
      <div className="flex items-center gap-1.5">
        <Button
          variant="secondary"
          className="px-2.5"
          disabled={page === 0}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeftIcon size={15} />
        </Button>
        <span className="px-1 tabular-nums">
          Page {page + 1} of {totalPages}
        </span>
        <Button
          variant="secondary"
          className="px-2.5"
          disabled={page + 1 >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          <ChevronRightIcon size={15} />
        </Button>
      </div>
    </div>
  );
}
