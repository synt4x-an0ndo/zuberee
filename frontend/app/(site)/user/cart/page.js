"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useCart } from "@/context/CartContext";

// User Cart — the shopping cart itself is a slide-over drawer already mounted in the site layout.
// This dedicated route opens that same drawer on arrival (reusing the existing cart UI, no duplication).
export default function UserCartPage() {
    const { openCart, count } = useCart();

    useEffect(() => { openCart(); }, [openCart]);

    return (
        <section className="account-page">
            <div className="container account-container">
                <div className="account-heading"><span>Eyara account</span><h1>Your cart</h1></div>
                <div className="account-section" style={{ textAlign: "center" }}>
                    <p style={{ opacity: 0.8 }}>
                        {count > 0
                            ? "Your cart is open on the right. Review your items and check out whenever you're ready."
                            : "Your cart is empty. Browse the shop and add a few pieces to get started."}
                    </p>
                    <div className="d-flex gap-2 justify-content-center mt-3">
                        <button type="button" className="account-submit compact" style={{ width: "auto" }} onClick={openCart}>View cart</button>
                        <Link href="/shop" className="account-link">Continue shopping</Link>
                    </div>
                </div>
            </div>
        </section>
    );
}
