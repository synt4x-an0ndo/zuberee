import { Suspense } from "react";
import { ResetPasswordPage } from "@/components/AccountPages";

export default function Page() {
  return (
    <Suspense fallback={<div className="account-loading">Loading...</div>}>
      <ResetPasswordPage />
    </Suspense>
  );
}
