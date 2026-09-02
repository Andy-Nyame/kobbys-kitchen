import Image from "next/image";

import ContentSection from "@/components/ui/ContentSection";
import PageIntro from "@/components/ui/PageIntro";
import { galleryItems } from "@/data/galleryData";

export const metadata = {
  title: "Gallery | Kobby's Kitchen",
  description:
    "See meals and people from Kobby's Kitchen in Tema Community Two.",
};

export default function GalleryPage() {
  return (
    <main className="page">
      <div className="container content-stack">
        <PageIntro
          eyebrow="Gallery"
          title="Kobby's Kitchen Gallery"
          description="A look at our meals and the people behind Kobby's Kitchen."
        />

        <ContentSection
          title="Food and Kitchen"
          description="Current menu availability and prices are shown on the Menu page."
        >
          <ul className="gallery-grid">
            {galleryItems.map((item) => (
              <li key={item.src}>
                <figure className="gallery-card">
                  <Image
                    alt={item.alt}
                    className="gallery-card__image"
                    height={900}
                    sizes="(min-width: 1200px) 24rem, (min-width: 720px) 45vw, 100vw"
                    src={item.src}
                    width={1200}
                  />
                  <figcaption>{item.caption}</figcaption>
                </figure>
              </li>
            ))}
          </ul>
        </ContentSection>
      </div>
    </main>
  );
}
