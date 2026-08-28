import { FindProgress } from "@/components/shared/load-progress";

export default function RequestDetailLoading() {
  return (
    <div className="mx-auto max-w-xl px-5 py-10 sm:px-8">
      <FindProgress percent={42} label="Sending your Find" />
    </div>
  );
}
