import { FindProgress } from "@/components/shared/load-progress";

export default function HubLoading() {
  return (
    <div className="grid h-dvh place-items-center bg-canvas px-6">
      <FindProgress percent={32} label="Opening FINDIT Hub" />
    </div>
  );
}
