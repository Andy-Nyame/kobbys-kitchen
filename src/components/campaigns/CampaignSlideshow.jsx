"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const ROTATION_INTERVAL_MS = 7000;
const SWIPE_THRESHOLD_PX = 48;

function CampaignImage({ campaign, priority }) {
  return (
    <>
      {campaign.mobileImagePath ? (
        <Image
          alt={campaign.altText}
          className="campaign-slideshow__image campaign-slideshow__image--mobile"
          height={campaign.mobileImageHeight}
          priority={priority}
          sizes="100vw"
          src={campaign.mobileImagePath}
          width={campaign.mobileImageWidth}
        />
      ) : null}
      <Image
        alt={campaign.altText}
        className={`campaign-slideshow__image${campaign.mobileImagePath ? " campaign-slideshow__image--desktop" : ""}`}
        height={campaign.desktopImageHeight}
        priority={priority}
        sizes="(max-width: 1279px) calc(100vw - 2.5rem), 1240px"
        src={campaign.desktopImagePath}
        width={campaign.desktopImageWidth}
      />
    </>
  );
}

export default function CampaignSlideshow({ campaigns }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef(null);
  const hasMultipleSlides = campaigns.length > 1;

  useEffect(() => {
    if (!hasMultipleSlides || paused) return undefined;

    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motionPreference.matches) return undefined;

    const interval = window.setInterval(() => {
      setCurrentIndex((index) => (index + 1) % campaigns.length);
    }, ROTATION_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [campaigns.length, hasMultipleSlides, paused]);

  if (!campaigns.length) return null;

  const safeIndex = currentIndex % campaigns.length;
  const campaign = campaigns[safeIndex];
  const showPrevious = () => {
    setCurrentIndex((index) => (index - 1 + campaigns.length) % campaigns.length);
  };
  const showNext = () => {
    setCurrentIndex((index) => (index + 1) % campaigns.length);
  };

  return (
    <section
      aria-label="Kobby's Kitchen promotions"
      aria-roledescription="carousel"
      className="campaign-slideshow"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
      onFocus={() => setPaused(true)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchEnd={(event) => {
        if (touchStartX.current === null || !hasMultipleSlides) return;
        const distance = event.changedTouches[0].clientX - touchStartX.current;
        touchStartX.current = null;
        if (Math.abs(distance) < SWIPE_THRESHOLD_PX) return;
        if (distance > 0) showPrevious();
        else showNext();
      }}
      onTouchStart={(event) => {
        touchStartX.current = event.touches[0].clientX;
      }}
    >
      <div className="campaign-slideshow__viewport">
        <Link
          aria-label={`${campaign.name}: ${campaign.headline || "View campaign"}. Order online.`}
          className="campaign-slideshow__link"
          href={campaign.destinationPath}
        >
          <CampaignImage campaign={campaign} priority />
        </Link>
      </div>

      {hasMultipleSlides ? (
        <div className="campaign-slideshow__controls">
          <button aria-label="Previous promotion" onClick={showPrevious} type="button">
            <span aria-hidden="true">←</span>
          </button>
          <div className="campaign-slideshow__dots" aria-label="Choose a promotion">
            {campaigns.map((item, index) => (
              <button
                aria-label={`Show promotion ${index + 1}: ${item.name}`}
                aria-pressed={index === safeIndex}
                key={item.id}
                onClick={() => setCurrentIndex(index)}
                type="button"
              />
            ))}
          </div>
          <button aria-label="Next promotion" onClick={showNext} type="button">
            <span aria-hidden="true">→</span>
          </button>
        </div>
      ) : null}
    </section>
  );
}
