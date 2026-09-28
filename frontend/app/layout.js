import { Inter, Raleway } from "next/font/google";
import "bootstrap/dist/css/bootstrap.min.css";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const raleway = Raleway({
  subsets: ["latin"],
  variable: "--font-raleway",
  display: "swap",
});

export const metadata = {
  title: "Eyara Fashion - Your Gateway to Global Footwear Elegance",
  description:
    "Layout clone (structure only, no images) of the Eyara Fashion index page, built with Next.js.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${raleway.variable}`}>
      <body>{children}</body>
    </html>
  );
}
