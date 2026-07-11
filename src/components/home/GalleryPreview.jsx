import Link from "next/link";

import ContentSection from "@/components/ui/ContentSection";

export default function GalleryPreview({ title, description, items }) {
  return (
    <ContentSection title={title} description={description}>
      <div className="card-grid">
        {items.map((item) => (
          <article key={item.title} className="card">
            <h3>{item.title}</h3>
            <p>{item.description}</p>
          </article>
        ))}
      </div>

      <div className="section-actions">
        <Link className="inline-link" href="/about">
          View the full About page gallery
        </Link>
      </div>
    </ContentSection>
  );
}
