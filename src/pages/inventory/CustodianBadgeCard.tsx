import type { RefObject } from "react";
import { QRCodeCanvas } from "qrcode.react";
import clsx from "clsx";
import { Avatar, personColor } from "../../components/ui/Avatar";
import { custodianQrPayload } from "../../lib/custodianQr";
import { fullName } from "../../lib/format";
import { officeName } from "../../lib/inventory";
import type { Custodian } from "../../types/api";
import { AccountabilityBadge } from "./InventoryAtoms";

/**
 * A custodian drawn as the property-custodian ID badge they would wear:
 * portrait card, lanyard slot, a colour band, photo, and a scannable strip.
 * Deliberately a different visual grammar from the receipt (solid band and
 * rounded corners here, monochrome paper and a torn edge there) so the two
 * never read as reskins of each other.
 *
 * The accountability tag is the one live fact on the card; everything else
 * is identity. `hideTag` drops it for the printed badge, which outlives any
 * particular day's custody.
 */
export function CustodianBadgeCard({
  custodian,
  className,
  qrRef,
  hideTag,
}: {
  custodian: Custodian;
  className?: string;
  /** Lets CustodianBadgePrintModal read the rendered QR canvas's pixels for
   * the print window, which can't render React itself. */
  qrRef?: RefObject<HTMLCanvasElement | null>;
  hideTag?: boolean;
}) {
  const color = personColor(custodian);

  return (
    <div className={clsx("relative", className)}>
      <div className="absolute top-1.5 left-1/2 z-10 h-2.5 w-9 -translate-x-1/2 rounded-full border border-black/15 bg-white/90" />

      <div className="overflow-hidden rounded-2xl bg-white text-black shadow-[0_12px_28px_-14px_rgba(0,0,0,0.4),0_2px_6px_rgba(0,0,0,0.08)] ring-1 ring-black/5">
        <div
          className="flex flex-col items-center pt-5 pb-9"
          style={{ background: `linear-gradient(135deg, ${color}, color-mix(in oklab, ${color} 55%, black))` }}
        >
          <p className="text-[9px] font-bold tracking-[0.22em] text-white/85 uppercase">ICTD Property Custodian</p>
        </div>

        <div className="-mt-8 flex justify-center">
          <div className="rounded-full border-[3px] border-white bg-white shadow-md">
            <Avatar person={custodian} size={68} className="text-xl" />
          </div>
        </div>

        <div className="flex flex-col items-center gap-0.5 px-4 pt-2 pb-3 text-center">
          <p className="text-base leading-tight font-bold">{fullName(custodian)}</p>
          <p className="font-mono text-[11px] text-black/45">
            {custodian.employee_number ? `#${custodian.employee_number}` : "No employee #"}
          </p>
          <p className="line-clamp-2 text-xs text-black/60">{officeName(custodian.departments)}</p>
        </div>

        {hideTag ? null : (
          <div className="flex justify-center pb-3">
            <AccountabilityBadge custodian={custodian} />
          </div>
        )}

        <div className="flex justify-center border-t border-black/10 bg-black/[0.02] py-3">
          <QRCodeCanvas
            ref={qrRef}
            value={custodianQrPayload(custodian)}
            size={64}
            level="M"
            marginSize={1}
            bgColor="#ffffff"
            fgColor="#000000"
          />
        </div>
      </div>
    </div>
  );
}
