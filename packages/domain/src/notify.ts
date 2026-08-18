export type CustomerReplyType = "in_stock" | "out_of_stock" | "can_order";

export function shouldNotifyCustomerOfReply(
  responseType: CustomerReplyType | string,
  prefs: {
    notify_in_stock?: boolean | null;
    notify_can_order?: boolean | null;
  }
): boolean {
  if (responseType === "in_stock") return prefs.notify_in_stock !== false;
  if (responseType === "can_order") return prefs.notify_can_order !== false;
  return false;
}

export function customerReplyAlertCopy(input: {
  responseType: CustomerReplyType | string;
  storeName?: string | null;
  productName: string;
}): { title: string; body: string } | null {
  const store = (input.storeName || "A store").trim() || "A store";
  const product = input.productName.trim() || "your Find";
  if (input.responseType === "in_stock") {
    return {
      title: `${store} has it in stock`,
      body: product,
    };
  }
  if (input.responseType === "can_order") {
    return {
      title: `${store} can order it`,
      body: product,
    };
  }
  return null;
}

export function customerReplyPushCopy(input: {
  responseType: CustomerReplyType | string;
  productName: string;
}): { title: string; body: string } | null {
  const product = input.productName.trim() || "your Find";
  if (input.responseType === "in_stock") {
    return { title: "In stock nearby", body: product };
  }
  if (input.responseType === "can_order") {
    return { title: "A store can order it", body: product };
  }
  return null;
}
