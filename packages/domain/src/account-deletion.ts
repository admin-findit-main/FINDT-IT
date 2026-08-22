import { SUPPORT_EMAIL } from "./admin";

/** Users must type this exact word (case-insensitive) to confirm deletion. */
export const ACCOUNT_DELETION_CONFIRMATION = "DELETE";

export function isAccountDeletionConfirmed(value: string | null | undefined): boolean {
  return (value || "").trim().toUpperCase() === ACCOUNT_DELETION_CONFIRMATION;
}

export function accountDeletionBlockReason(input: {
  isOperator: boolean;
  ownedStoreNames: string[];
}): string | null {
  if (input.isOperator) {
    return "The FINDIT operator account cannot be deleted from the app.";
  }
  if (input.ownedStoreNames.length === 1) {
    return `Close or transfer ${input.ownedStoreNames[0]} before deleting this account, or email ${SUPPORT_EMAIL}.`;
  }
  if (input.ownedStoreNames.length > 1) {
    return `This account still owns ${input.ownedStoreNames.length} stores. Transfer or close them first, or email ${SUPPORT_EMAIL}.`;
  }
  return null;
}
