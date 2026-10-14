"use client";

import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { FeedbackProvider } from "@/context/FeedbackContext";
import { SiteProvider } from "@/context/SiteContext";

export default function Providers({ children }) {
  return (
    <FeedbackProvider>
      <SiteProvider>
        <AuthProvider>
          <CartProvider>{children}</CartProvider>
        </AuthProvider>
      </SiteProvider>
    </FeedbackProvider>
  );
}
