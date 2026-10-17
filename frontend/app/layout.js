import "./globals.css";
import Providers from "@/components/Providers";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";

export const metadata = {
  title: {
    default: "Zuberee",
    template: "%s | Zuberee",
  },
  description: "Shop Zuberee online with cash on delivery.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0e2b1b",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
