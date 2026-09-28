export default function ProductCard({ product }) {
  const href = `/frontEnd/product-page/${product.id}`;
  const extraColors = Math.max(0, product.colors - 3);

  return (
    <div className="col-6 col-md-4 col-lg-3 px-1 px-md-2 mb-3">
      <div className="px-1 my-2 my-md-5 position-relative">
        <div className="card product-div p-1 p-md-2 bg-white h-100 product-card position-relative d-flex flex-column">
          {/* 1. image area — placeholder block, no <img> in this clone */}
          <a style={{ textDecoration: "none", order: 0 }} href={href}>
            <div className="position-relative overflow-hidden product-image-container">
              <div className="product-image-placeholder">
                <ImagePlaceholderIcon />
              </div>
            </div>
          </a>

          {/* 2. colour swatches */}
          <div
            className="d-flex align-items-center gap-2 px-2 px-md-3 mt-1 mt-lg-2 pb-2"
            style={{ order: 3 }}
          >
            <div className="product-color-wrapper d-flex gap-2">
              {Array.from({ length: Math.min(3, product.colors) }).map((_, i) => (
                <div className="product_color_image_div" key={i}>
                  <span />
                </div>
              ))}
              {extraColors > 0 && (
                <small className="text-muted align-self-center">+{extraColors}</small>
              )}
            </div>
          </div>

          {/* 3. title */}
          <a style={{ textDecoration: "none", order: 1 }} href={href}>
            <div className="px-2 px-md-3 pt-2 pt-md-3 pb-0">
              <p className="mb-1">
                <small
                  className="text-decoration-none fw-bold product-card-title text-truncate d-block"
                  style={{ fontFamily: "Inter, sans-serif" }}
                >
                  {product.title}
                </small>
              </p>
            </div>
          </a>

          {/* 4. prices */}
          <div className="px-2 px-md-3 pb-1" style={{ order: 2 }}>
            <div className="d-flex gap-3 align-items-center mt-1 mt-md-2">
              <span className="discount-price text-decoration-line-through">
                {product.oldPrice}৳
              </span>
              <span className="fw-bold product-price">{product.price}৳</span>
            </div>
          </div>

        </div>

        {/* status badge — absolutely positioned against the wrapper, like the live DOM */}
        <div
          className={`position-absolute m-2 px-2 px-md-3 py-1 shadow-sm product_status_badge ${
            product.status === "IN-STOCK" ? "in-stock-badge" : ""
          }`}
        >
          {product.status}
        </div>
      </div>
    </div>
  );
}

function ImagePlaceholderIcon() {
  return (
    <svg
      width="30"
      height="30"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="m4 17 5-5 4 4 3-3 4 4" />
    </svg>
  );
}
