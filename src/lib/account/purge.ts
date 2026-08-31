import { accountDeletionBlockReason } from "@findit/domain";
import { toPublicError } from "@/lib/security/public-error";
import { logSecurityEvent } from "@/lib/security/audit";

export async function purgeFinditAccount(input: {
  userId: string;
  isOperator: boolean;
  accessToken?: string | null;
}): Promise<{ error?: string }> {
  const { createServiceClient } = await import("@/lib/supabase/admin");
  const admin = createServiceClient();
  const { data: ownedStores } = await admin
    .from("stores")
    .select("name")
    .eq("owner_id", input.userId);
  const blocked = accountDeletionBlockReason({
    isOperator: input.isOperator,
    ownedStoreNames: (ownedStores || []).map((store) => store.name),
  });
  if (blocked) return { error: blocked };

  const { data: responses } = await admin
    .from("store_responses")
    .select("id, store_id")
    .eq("responded_by", input.userId);
  if (responses?.length) {
    const storeIds = [...new Set(responses.map((row) => row.store_id))];
    const { data: stores } = await admin
      .from("stores")
      .select("id, owner_id")
      .in("id", storeIds);
    const ownerByStore = new Map(
      (stores || []).map((store) => [store.id, store.owner_id])
    );
    for (const row of responses) {
      const ownerId = ownerByStore.get(row.store_id);
      if (ownerId && ownerId !== input.userId) {
        await admin
          .from("store_responses")
          .update({ responded_by: ownerId })
          .eq("id", row.id);
      }
    }
    const { count: leftover } = await admin
      .from("store_responses")
      .select("*", { count: "exact", head: true })
      .eq("responded_by", input.userId);
    if (leftover) {
      return {
        error:
          "Couldn't delete this account because store replies are still linked. Email FINDIT support.",
      };
    }
  }

  const { REQUEST_IMAGES_BUCKET } = await import("@/lib/services/storage");
  const { data: files } = await admin.storage
    .from(REQUEST_IMAGES_BUCKET)
    .list(input.userId, { limit: 1000 });
  if (files?.length) {
    await admin.storage
      .from(REQUEST_IMAGES_BUCKET)
      .remove(files.map((file) => `${input.userId}/${file.name}`));
  }

  if (input.accessToken) {
    await admin.auth.admin.signOut(input.accessToken, "global");
  }
  const { error } = await admin.auth.admin.deleteUser(input.userId);
  if (error) {
    return {
      error: toPublicError(error, "Could not delete this account. Try again or email support."),
    };
  }
  void logSecurityEvent({
    actorId: input.userId,
    action: "account_deleted",
    resource: input.userId,
  });
  return {};
}
