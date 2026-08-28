export type PasswordScore = 0 | 1 | 2 | 3 | 4;

export type PasswordStrength = {
  score: PasswordScore;
  label: "Too weak" | "Weak" | "Fair" | "Good" | "Strong";
  ok: boolean;
  hints: string[];
};

const COMMON = new Set([
    "password",
    "password1",
    "password123",
  "12345678",
  "123456789",
  "qwertyui",
  "qwerty123",
  "letmein",
  "letmein1",
  "findit",
  "findit123",
  "welcome",
  "welcome1",
  "iloveyou",
  "admin123",
  "abcdefgh",
]);

/** Minimum score we accept for a new password (8+ chars and not a common string). */
export const MIN_PASSWORD_SCORE = 2;

export function passwordStrength(
  password: string,
  email?: string | null
): PasswordStrength {
  const hints: string[] = [];
  let score = 0;

  if (password.length >= 8) score += 1;
  else hints.push("Use at least 8 characters");

  if (password.length >= 12) score += 1;

  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  else if (password.length >= 8) hints.push("Mix uppercase and lowercase letters");

  if (/\d/.test(password)) score += 1;
  else hints.push("Add a number");

  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  const local = (email || "").split("@")[0]?.trim();
  if (local && local.length >= 3 && password.toLowerCase().includes(local.toLowerCase())) {
    score = Math.max(0, score - 2);
    hints.push("Don’t use your email in the password");
  }

  const compact = password.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (COMMON.has(password.toLowerCase()) || COMMON.has(compact)) {
    score = 0;
    hints.unshift("That password is too common");
  }

  const clamped = Math.min(4, score) as PasswordScore;
  const label =
    clamped <= 0
      ? "Too weak"
      : clamped === 1
        ? "Weak"
        : clamped === 2
          ? "Fair"
          : clamped === 3
            ? "Good"
            : "Strong";

  return {
    score: clamped,
    label,
    ok: clamped >= MIN_PASSWORD_SCORE && password.length >= 8,
    hints: hints.slice(0, 2),
  };
}

export function passwordRejectReason(
  password: string,
  email?: string | null
): string | null {
  const result = passwordStrength(password, email);
  if (result.ok) return null;
  return result.hints[0] || "Choose a stronger password";
}
