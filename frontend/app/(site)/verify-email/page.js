import { Suspense } from "react";
import VerifyEmailForm from "./VerifyEmailForm";

export const metadata = { title: "Verify your email" };

export default function VerifyEmailPage() {
  return <Suspense fallback={<div className="container section" />}><VerifyEmailForm /></Suspense>;
}