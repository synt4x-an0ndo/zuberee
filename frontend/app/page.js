import Header from "../components/Header";
import Footer from "../components/Footer";
import MobileBottomNav from "../components/MobileBottomNav";
import ProductSection from "../components/ProductSection";
import { sections } from "../lib/data";

export default function HomePage() {
  return (
    <div className="gradient-bg">
      <div className="frontEndLayout">
        <Header />

        <main className="frontMain" style={{ paddingBottom: 80 }}>
          <div style={{ minHeight: "60vh" }}>
            {/* ---------------- hero banner (image slot, intentionally empty) ---------------- */}
            <section className="container hero_banner" aria-label="Eyara Fashion">
              <div className="ph hero_banner_placeholder">hero banner — 32 : 13</div>
            </section>

            {/* ---------------- product sections ---------------- */}
            <div className="container mb-3 mb-md-5 mt-0 py-2">
              {sections.map((section) => (
                <ProductSection section={section} key={section.title} />
              ))}

              <div className="col-12 text-center my-4">
                <button className="slot-loadmore-btn">
                  <div>Load More</div>
                </button>
              </div>
            </div>
          </div>
        </main>

        <MobileBottomNav />
        <Footer />
      </div>
    </div>
  );
}
