/**
 * Deep-link / universal-link builders for customer + employee apps.
 * Scheme: findit://  (customer)  findit-employee://  (employee)
 */

export const CUSTOMER_APP_SCHEME = "findit";
export const EMPLOYEE_APP_SCHEME = "findit-employee";

export function customerRequestDeepLink(requestId: string): string {
  return `${CUSTOMER_APP_SCHEME}://request/${requestId}`;
}

export function employeeRequestDeepLink(requestId: string, storeId?: string): string {
  const base = `${EMPLOYEE_APP_SCHEME}://request/${requestId}`;
  return storeId ? `${base}?storeId=${encodeURIComponent(storeId)}` : base;
}

export function parseCustomerDeepLink(url: string): { type: "request"; id: string } | null {
  try {
    const u = new URL(url);
    if (u.protocol !== `${CUSTOMER_APP_SCHEME}:`) return null;
    const parts = u.pathname.replace(/^\//, "").split("/");
    if (parts[0] === "request" && parts[1]) {
      return { type: "request", id: parts[1] };
    }
    // findit://request/<id> sometimes lands host=request
    if (u.host === "request" && u.pathname.slice(1)) {
      return { type: "request", id: u.pathname.replace(/^\//, "") };
    }
    return null;
  } catch {
    return null;
  }
}

export function parseEmployeeDeepLink(
  url: string
): { type: "request"; id: string; storeId?: string } | null {
  try {
    const u = new URL(url);
    if (u.protocol !== `${EMPLOYEE_APP_SCHEME}:`) return null;
    const storeId = u.searchParams.get("storeId") || undefined;
    const parts = u.pathname.replace(/^\//, "").split("/");
    if (parts[0] === "request" && parts[1]) {
      return { type: "request", id: parts[1], storeId };
    }
    if (u.host === "request" && u.pathname.slice(1)) {
      return {
        type: "request",
        id: u.pathname.replace(/^\//, "").split("?")[0],
        storeId,
      };
    }
    return null;
  } catch {
    return null;
  }
}
