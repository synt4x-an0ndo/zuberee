import ProductCard from "./ProductCard";

export default function ProductSection({ section }) {
  return (
    <div className="row position-relative">
      <div className="col-12 d-flex justify-content-between align-items-center position-relative home_page_card_header mb-2">
        <div className="slot-name">
          <small className="featured-heading">{section.title}</small>
        </div>
        <a className="btn btn-outline-dark btn-sm fw-semibold" href={section.href}>
          View All
        </a>
      </div>

      <div className="row mx-0 mb-4">
        {section.products.map((p) => (
          <ProductCard product={p} key={p.id} />
        ))}
      </div>
    </div>
  );
}
