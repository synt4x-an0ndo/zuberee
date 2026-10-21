/** Courier partners shown in the admin "Courier Entry" selectors. */
export const COURIER_OPTIONS = [
  { value: "", label: "Select Courier" },
  { value: "pathao", label: "Pathao Courier" },
  { value: "redx", label: "RedX" },
  { value: "steadfast", label: "Steadfast" },
  { value: "eCourier", label: "eCourier" },
  { value: "sundarban", label: "Sundarban Courier" },
  { value: "sa-paribahan", label: "SA Paribahan" },
  { value: "paperfly", label: "Paperfly" },
  { value: "in-house", label: "In-house Delivery" },
  { value: "other", label: "Other" },
];

export function courierLabel(value) {
  if (!value) return "";
  const known = COURIER_OPTIONS.find((option) => option.value === value);
  return known ? known.label : String(value);
}

/** Include an unknown stored courier value in a select without losing it. */
export function courierOptionsWith(current) {
  if (current && !COURIER_OPTIONS.some((option) => option.value === current)) {
    return [...COURIER_OPTIONS, { value: current, label: String(current) }];
  }
  return COURIER_OPTIONS;
}
