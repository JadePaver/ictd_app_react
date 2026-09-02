import type { RefObject } from "react";
import { QRCodeCanvas } from "qrcode.react";
import clsx from "clsx";
import { Avatar, personColor } from "../../components/ui/Avatar";
import { Badge } from "../../components/ui/Badge";
import { custodianQrPayload } from "../../lib/custodianQr";
import { fullName } from "../../lib/format";
import type { Custodian } from "../../types/api";

/**
 * A custodian isn't a document (MrReceiptCard) or a catalog entry — they're
 * a *person* being tracked for accountability, so the natural physical
 * object to model is an access badge: portrait card, photo, a lanyard
 * punch, and a scannable strip at the bottom, the same object a real
 * property-custodian ID would be. Deliberately built from different visual
 * grammar than the receipt (solid color band and rounded corners here, vs.
 * monochrome paper and a torn edge there) so the two don't read as reskins
 * of each other.
 *
 * The accountability tag at the bottom is the one live, non-decorative
 * fact on the card — everything else (name, photo, QR) is identity, this
 * is status: clear / currently holding something / has something overdue.
 */
export function CustodianBadgeCard({
  custodian,
  className,
  qrRef,
}: {
  custodian: Custodian;
  className?: string;
  /** Lets a caller (CustodianBadgePrintModal) reach the rendered QR canvas
   * to pull a dataURL for the print popup — that window can't render React,
   * so the same on-screen preview has to hand its pixels over some other
   * way. Optional: the detail-modal view has no use for it. */
  qrRef?: RefObject<HTMLCanvasElement | null>;
}) {
  const color = personColor(custodian);
  const accountability = custodian.overdueItemCount
    ? { label: `${custodian.overdueItemCount} OVERDUE`, tone: "critical" as const }
    : custodian.activeItemCount
      ? { label: `${custodian.activeItemCount} ON LOAN`, tone: "accent" as const }
      : { label: "CLEAR", tone: "neutral" as const };

  return (
    <div className={clsx("relative", className)}>
      <div className="absolute top-1.5 left-1/2 z-10 h-2.5 w-9 -translate-x-1/2 rounded-full border border-black/15 bg-white/90" />

      <div className="overflow-hidden rounded-2xl bg-white text-black shadow-lg">
        <div
          className="flex flex-col items-center pt-5 pb-9"
          style={{ background: `linear-gradient(135deg, ${color}, color-mix(in oklab, ${color} 55%, black))` }}
        >
          <p className="text-[9px] font-bold tracking-[0.22em] text-white/85 uppercase">ICTD Property Custodian</p>
        </div>

        <div className="-mt-8 flex justify-center">
          <div className="rounded-full border-[3px] border-white shadow-md">
            <Avatar person={custodian} size={68} className="text-xl" />
          </div>
        </div>

        <div className="flex flex-col items-center gap-0.5 px-4 pt-2 pb-3 text-center">
          <p className="text-base font-bold">{fullName(custodian)}</p>
          <p className="font-mono text-[11px] text-black/45">
            {custodian.employee_number ? `#${custodian.employee_number}` : "No employee #"}
          </p>
          <p className="text-xs text-black/60">{custodian.departments?.label ?? "No department"}</p>
        </div>

        <div className="flex justify-center pb-3">
          <Badge tone={accountability.tone}>{accountability.label}</Badge>
        </div>

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
