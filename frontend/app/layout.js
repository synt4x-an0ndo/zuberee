import "@/styles/toast.css";
import ToastHost from "@/components/ToastHost";
import { SiteProvider } from "@/context/SiteContext";
import { CartProvider } from "@/context/CartContext";
import { AuthProvider } from "@/context/AuthContext";

/* One Bootstrap build avoids conflicting v4/v5 utility and component styles. */
import "@/styles/css/fb5856ed929537ce.css";
import "@/styles/css/1fdb5ed2d6190b11.css";
import "@/styles/css/77113baa9b3e7098.css";
import "@/styles/css/4df78f2cd73d6b26.css";
import "@/styles/css/a555a7836cdfe68d.css";
import "@/styles/theme.css";

export const metadata = {
  title: {
    default: "Eyara Fashion — Modern style, made easy",
    template: "%s | Eyara Fashion",
  },
  description: "Explore carefully selected fashion, everyday essentials, and new-season favourites at Eyara Fashion.",
  applicationName: "Eyara Fashion",
  openGraph: {
    type: "website",
    locale: "en_BD",
    siteName: "Eyara Fashion",
    title: "Eyara Fashion — Modern style, made easy",
    description: "Explore carefully selected fashion and everyday essentials.",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="app-root">
        <SiteProvider>
          <AuthProvider>
            <CartProvider>
              {children}
            </CartProvider>
          </AuthProvider>
        </SiteProvider>
        {/* Global top-left toast notifications (persists across route changes) */}
        <ToastHost />
      </body>
    </html>
  );
}
