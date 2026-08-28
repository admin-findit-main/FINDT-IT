import { LoadMark } from "@/components/shared/load-progress";

export default function CustomerLoading() {
  return <LoadMark percent={42} label="Opening FINDIT" />;
}
