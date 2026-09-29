import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { SiteProvider } from "@/context/SiteContext";
import { CartProvider } from "@/context/CartContext";

/* Common stylesheets - same order as the original site */
import "@/styles/css/d3df112486f97f47.css";
import "@/styles/css/b3384800399bfa75.css";
import "@/styles/css/e81a34e8d44b3efd.css"; // Inter font-face
import "@/styles/css/fb5856ed929537ce.css"; // bootstrap
import "@/styles/css/1fdb5ed2d6190b11.css"; // storefront design system + toast styles
import "@/styles/css/77113baa9b3e7098.css";
import "@/styles/css/4df78f2cd73d6b26.css";
import "@/styles/css/a555a7836cdfe68d.css";

export const metadata = {
  title: "",
  description: "",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      style={{
        "--primary-color": "#ff641f",
        "--primary-hover": "#e84b0b",
        "--primary-dark": "#c93700",
        "--primary-light": "#fff1eb",
        "--primary-rgb": "255,100,31",
        "--primary-gradient-start": "#ff7a18",
        "--primary-gradient-mid": "#ff641f",
        "--primary-gradient-end": "#ffb52e",
        "--hover-color": "#d94300",
        "--active-color": "#b93800",
      }}
    >
      <body>
        <SiteProvider>
          <CartProvider>
            {children}
            <ToastContainer position="top-right" autoClose={2500} theme="colored" />
          </CartProvider>
        </SiteProvider>
      </body>
    </html>
  );
}
