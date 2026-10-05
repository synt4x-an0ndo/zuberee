"use client";

import { ToastContainer } from "react-toastify";

export default function ToastHost() {
  return <ToastContainer position="top-right" autoClose={2500} theme="colored" />;
}