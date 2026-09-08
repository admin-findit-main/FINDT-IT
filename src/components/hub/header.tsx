export function HubHeader({
  storeName,
  online,
  employeeName,
}: {
  storeName: string;
  online: boolean;
  employeeName?: string | null;
}) {
  return (
    <header className="flex min-h-20 shrink-0 items-center justify-between border-b border-[#E2DCDE] bg-white px-5 md:px-8">
      <div className="flex min-w-0 items-center gap-5">
        <p className="shrink-0 text-xl font-black tracking-[-0.04em] text-[#171315]">
          FINDIT <span className="text-[#8E1F2D]">HUB</span>
        </p>
        <div className="hidden h-8 w-px bg-[#E2DCDE] sm:block" />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#81797C]">
            Current store
          </p>
          <p className="truncate text-base font-semibold text-[#171315]">
            {storeName || "FINDIT store"}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-4">
        <span className="flex items-center gap-2 text-sm font-medium text-[#5F585B]">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              online ? "bg-[#1E9A62]" : "bg-[#B42332]"
            }`}
          />
          {online ? "Online" : "Offline"}
        </span>
        {employeeName ? (
          <>
            <div className="hidden h-7 w-px bg-[#E2DCDE] sm:block" />
            <p className="hidden max-w-44 truncate text-sm font-semibold text-[#302A2D] sm:block">
              {employeeName}
            </p>
          </>
        ) : null}
      </div>
    </header>
  );
}
