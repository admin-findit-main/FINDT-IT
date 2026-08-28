import { FindProgress } from "@/components/shared/load-progress";

export default function RootLoading() {
  return (
    <div className="mx-auto max-w-xl px-5 py-12">
      <FindProgress percent={24} label="Opening FINDIT" />
    </div>
  );
}
