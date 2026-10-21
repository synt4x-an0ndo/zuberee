"use client";

import { useState } from "react";
import { FiEye, FiEyeOff } from "react-icons/fi";
import { Input } from "@/components/ui";

export default function PasswordInput({ id, autoComplete = "current-password", ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-wrap">
      <Input id={id} type={visible ? "text" : "password"} autoComplete={autoComplete} {...props} />
      <button type="button" className="password-toggle" onClick={() => setVisible((v) => !v)} aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible}>
        {visible ? <FiEyeOff aria-hidden="true" /> : <FiEye aria-hidden="true" />}
      </button>
    </div>
  );
}
