import { FindProgress } from "@/components/shared/load-progress";

export default function StoreLoading() {
  return (
    <div className="mx-auto max-w-xl px-5 py-10">
      <FindProgress percent={28} label="Opening FINDIT" />
    </div>
  );
}
