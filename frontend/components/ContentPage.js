"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import Loader from "@/components/Loader";

/**
 * Generic CMS content page.
 *  - `endpoint` e.g. "api/about-us"  or  "api/pages/privacy-policy"
 * Renders { title, content } (content = HTML) returned by the backend.
 */
export default function ContentPage({ endpoint, headingFallback }) {
  const [data, setData] = useState(null);
  const [state, setState] = useState("loading"); // loading | ok | missing | error

  useEffect(() => {
    let alive = true;
    (async () => {
      setState("loading");
      try {
        const r = await api.get(endpoint, { auth: false });
        if (!alive) return;
        if (r && (r.content || r.title || r.data)) {
          setData(r.data && typeof r.data === "object" && "content" in r.data ? r.data : r);
          setState("ok");
        } else {
          setState("missing");
        }
      } catch (e) {
        if (!alive) return;
        setState(e.status === 404 ? "missing" : "error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [endpoint]);

  if (state === "loading") return <Loader />;

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-lg-9">
          {state === "ok" ? (
            <>
              <h3 className="fw-bold mb-4" style={{ color: "var(--primary-color)" }}>
                {data?.title || headingFallback}
              </h3>
              <div
                className="content-card bg-white border rounded p-4"
                dangerouslySetInnerHTML={{ __html: data?.content || "" }}
              />
            </>
          ) : (
            <div className="text-center py-5 text-muted">
              <h5>{headingFallback}</h5>
              <p className="small">
                {state === "missing"
                  ? "This page's content will appear here once the backend serves it from the pages API."
                  : "Unable to load content right now. Please try again later."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
