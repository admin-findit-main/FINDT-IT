import { FindProgress } from "@/components/shared/load-progress";

export default function HubLoading() {
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas">
      <FindProgress percent={18} label="Loading Hub" size="inline" />
    </div>
  );
}
