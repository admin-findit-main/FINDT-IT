import { boundUuid } from "@findit/domain";
import { cookies } from "next/headers";
import { ACTIVE_STORE_COOKIE } from "@/lib/services/active-store-cookie";

export { ACTIVE_STORE_COOKIE };

/** Read the owner's selected location cookie (server-only helper, not a server action). */
export async function readActiveStoreCookie(): Promise<string | null> {
  const jar = await cookies();
  const value = jar.get(ACTIVE_STORE_COOKIE)?.value;
  return boundUuid(value || "") || null;
}
