"use client";

import Link from "next/link";

export default function ErrorPage({ reset }) {
  return (
    <main className="page">
      <div className="container content-stack">
        <section className="content-section">
          <div className="content-section__header">
            <p className="page-intro__eyebrow">Error</p>
            <h1>Something Went Wrong</h1>
            <p>
              The page could not be loaded right now. Please try again or return
              to another section of Kobby&apos;s Kitchen.
            </p>
          </div>
          <div className="content-section__body">
            <div className="section-actions">
              <button className="button-link button-link--primary" onClick={reset} type="button">
                Try Again
              </button>
              <Link className="button-link button-link--secondary" href="/">
                Go Home
              </Link>
              <Link className="button-link button-link--secondary" href="/menu">
                View Menu
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
