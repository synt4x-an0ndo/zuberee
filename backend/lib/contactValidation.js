/** Shared customer-contact validation for every order-creation path. */

export function normalizeBdPhone(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.startsWith("880")) return `0${digits.slice(3)}`;
  return digits;
}

export function isValidBdPhone(value) {
  return /^01[3-9]\d{8}$/.test(normalizeBdPhone(value));
}

export function normalizeEmail(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function isValidEmail(value) {
  const email = normalizeEmail(value);
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Return normalized contact details or throw a 400-style error object.
 * Name remains caller-specific (guest/account fallbacks differ), while phone
 * and email are mandatory for every newly submitted order.
 */
export function requireValidOrderContact({ phone, email }) {
  const normalizedPhone = normalizeBdPhone(phone);
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedPhone) {
    const error = new Error("Customer phone number is required.");
    error.status = 400;
    throw error;
  }
  if (!isValidBdPhone(normalizedPhone)) {
    const error = new Error("Enter a valid Bangladeshi mobile number (01XXXXXXXXX).");
    error.status = 400;
    throw error;
  }
  if (!normalizedEmail) {
    const error = new Error("Customer email address is required.");
    error.status = 400;
    throw error;
  }
  if (!isValidEmail(normalizedEmail)) {
    const error = new Error("Enter a valid email address.");
    error.status = 400;
    throw error;
  }

  return { phone: normalizedPhone, email: normalizedEmail };
}
