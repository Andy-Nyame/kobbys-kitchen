import Image from "next/image";
import Link from "next/link";

import ContentSection from "@/components/ui/ContentSection";
import ImagePlaceholder from "@/components/ui/ImagePlaceholder";

export default function GalleryPreview({
  title,
  description,
  items,
  emptyState,
}) {
  return (
    <ContentSection title={title} description={description}>
      <div className="gallery-grid">
        {items.map((item) => (
          <article key={item.title} className="gallery-card">
            {item.image ? (
              <Image
                alt={item.image.alt}
                className="gallery-card__image"
                src={item.image.src}
                width={item.image.width}
                height={item.image.height}
              />
            ) : (
              <ImagePlaceholder
                className="gallery-card__placeholder"
                label={item.title}
              />
            )}
            <h3>{item.title}</h3>
          </article>
        ))}
      </div>

      {emptyState ? <p className="section-note">{emptyState}</p> : null}

      <div className="section-actions">
        <Link className="inline-link" href="/about">
          View Gallery
        </Link>
      </div>
    </ContentSection>
  );
}
