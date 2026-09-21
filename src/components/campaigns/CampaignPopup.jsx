"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";

import {
  getCampaignPopupStoragePolicy,
  shouldScheduleCampaignPopup,
} from "@/lib/campaigns/popup";

const POPUP_DELAY_MS = 2200;
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not(:disabled)",
  "input:not(:disabled)",
  "select:not(:disabled)",
  "textarea:not(:disabled)",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function getStorage(policy) {
  if (policy?.storage === "local") return window.localStorage;
  if (policy?.storage === "session") return window.sessionStorage;
  return null;
}

export default function CampaignPopup({ campaign, viewerKey = null }) {
  const pathname = usePathname();
  const [openContext, setOpenContext] = useState(null);
  const dialogRef = useRef(null);
  const modalRootRef = useRef(null);
  const activeContext = campaign ? `${campaign.id}:${pathname}` : null;
  const open = openContext === activeContext;

  useEffect(() => {
    if (!campaign) return undefined;

    const policy = getCampaignPopupStoragePolicy(campaign, viewerKey);
    let hasBeenSeen = false;
    try {
      const storage = getStorage(policy);
      hasBeenSeen = Boolean(storage && policy.key && storage.getItem(policy.key));
    } catch {}

    if (!shouldScheduleCampaignPopup({ campaign, pathname, hasBeenSeen })) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      try {
        const storage = getStorage(policy);
        if (storage && policy.key) storage.setItem(policy.key, "seen");
      } catch {}
      setOpenContext(`${campaign.id}:${pathname}`);
    }, POPUP_DELAY_MS);

    return () => window.clearTimeout(timeout);
  }, [campaign, pathname, viewerKey]);

  useEffect(() => {
    if (!open || !dialogRef.current || !modalRootRef.current) return undefined;

    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const backgroundElements = [...document.body.children].filter(
      (element) => element !== modalRootRef.current
    );
    const previousBackgroundState = backgroundElements.map((element) => ({
      element,
      inert: element.inert,
      ariaHidden: element.getAttribute("aria-hidden"),
    }));

    document.body.style.overflow = "hidden";
    for (const element of backgroundElements) {
      element.inert = true;
      element.setAttribute("aria-hidden", "true");
    }

    const focusable = [...dialogRef.current.querySelectorAll(FOCUSABLE_SELECTOR)];
    focusable[0]?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && campaign.dismissible) {
        setOpenContext(null);
        return;
      }
      if (event.key !== "Tab") return;

      const controls = [...dialogRef.current.querySelectorAll(FOCUSABLE_SELECTOR)];
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      for (const state of previousBackgroundState) {
        state.element.inert = state.inert;
        if (state.ariaHidden === null) state.element.removeAttribute("aria-hidden");
        else state.element.setAttribute("aria-hidden", state.ariaHidden);
      }
      previousFocus?.focus?.();
    };
  }, [campaign, open]);

  if (typeof document === "undefined" || !campaign || !open) return null;

  return createPortal(
    <div className="campaign-popup-root" ref={modalRootRef}>
      <div
        className="campaign-popup__backdrop"
        onMouseDown={(event) => {
          if (campaign.dismissible && event.target === event.currentTarget) setOpenContext(null);
        }}
      >
        <section
          aria-describedby="campaign-popup-description"
          aria-labelledby="campaign-popup-title"
          aria-modal="true"
          className="campaign-popup"
          ref={dialogRef}
          role="dialog"
        >
          {campaign.dismissible ? (
            <button
              aria-label="Close promotion"
              className="campaign-popup__close"
              onClick={() => setOpenContext(null)}
              type="button"
            >
              <span aria-hidden="true">×</span>
            </button>
          ) : null}
          <div className="campaign-popup__artwork">
            {campaign.mobileImagePath ? (
              <Image
                alt=""
                className="campaign-popup__image campaign-popup__image--mobile"
                height={campaign.mobileImageHeight}
                sizes="(max-width: 639px) calc(100vw - 2rem), 540px"
                src={campaign.mobileImagePath}
                width={campaign.mobileImageWidth}
              />
            ) : null}
            <Image
              alt=""
              className={`campaign-popup__image${campaign.mobileImagePath ? " campaign-popup__image--desktop" : ""}`}
              height={campaign.desktopImageHeight}
              priority
              sizes="(max-width: 639px) calc(100vw - 2rem), 540px"
              src={campaign.desktopImagePath}
              width={campaign.desktopImageWidth}
            />
          </div>
          <div className="campaign-popup__actions">
            <div className="sr-only">
              <h2 id="campaign-popup-title">{campaign.headline || campaign.name}</h2>
              <p id="campaign-popup-description">{campaign.altText}</p>
            </div>
            <Link className="button-link button-link--primary" href={campaign.destinationPath}>
              Order Now
            </Link>
          </div>
        </section>
      </div>
    </div>,
    document.body
  );
}
