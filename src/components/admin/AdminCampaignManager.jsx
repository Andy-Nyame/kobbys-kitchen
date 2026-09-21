"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  CAMPAIGN_ADMIN_ACTION,
  serializeCampaignDateTimeForEditor,
} from "@/lib/campaigns/admin-validation";

function toEditorCampaign(campaign) {
  return {
    ...campaign,
    startAt: serializeCampaignDateTimeForEditor(campaign.startAt),
    endAt: serializeCampaignDateTimeForEditor(campaign.endAt),
  };
}

function CampaignEditor({ campaign, onSaved }) {
  const [draft, setDraft] = useState(() => toEditorCampaign(campaign));
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState({ ok: null, message: "" });

  function update(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function save(event) {
    event.preventDefault();
    setPending(true);
    setFeedback({ ok: null, message: "" });

    try {
      const response = await fetch("/api/admin/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: CAMPAIGN_ADMIN_ACTION.UPDATE,
          id: draft.id,
          active: draft.active,
          slideshowEnabled: draft.slideshowEnabled,
          popupEnabled: draft.popupEnabled,
          startAt: draft.startAt || null,
          endAt: draft.endAt || null,
          priority: Number(draft.priority),
          destinationPath: draft.destinationPath,
          popupFrequency: draft.popupFrequency,
          desktopImagePath: draft.desktopImagePath,
          desktopImageWidth: Number(draft.desktopImageWidth),
          desktopImageHeight: Number(draft.desktopImageHeight),
          mobileImagePath: draft.mobileImagePath || null,
          mobileImageWidth: draft.mobileImageWidth === "" || draft.mobileImageWidth === null
            ? null
            : Number(draft.mobileImageWidth),
          mobileImageHeight: draft.mobileImageHeight === "" || draft.mobileImageHeight === null
            ? null
            : Number(draft.mobileImageHeight),
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.message || "Campaign settings could not be saved.");
      }
      setFeedback({ ok: true, message: result.message });
      onSaved();
    } catch (error) {
      setFeedback({
        ok: false,
        message: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <article className="admin-campaign-card">
      <div className="admin-campaign-card__preview">
        <Image
          alt={campaign.altText}
          height={campaign.desktopImageHeight}
          sizes="(max-width: 767px) 100vw, 280px"
          src={campaign.desktopImagePath}
          width={campaign.desktopImageWidth}
        />
      </div>
      <form className="admin-campaign-form" onSubmit={save}>
        <div className="admin-campaign-form__heading">
          <div>
            <p className="admin-section-eyebrow">Campaign</p>
            <h2>{campaign.name}</h2>
          </div>
          <span className={draft.active ? "admin-status admin-status--campaign-active" : "admin-status"}>
            {draft.active ? "Active" : "Inactive"}
          </span>
        </div>

        <div className="admin-campaign-toggle-grid">
          <label className="admin-campaign-toggle">
            <input
              checked={draft.active}
              disabled={pending}
              onChange={(event) => update("active", event.target.checked)}
              type="checkbox"
            />
            <span><strong>Campaign active</strong><small>Master visibility control</small></span>
          </label>
          <label className="admin-campaign-toggle">
            <input
              checked={draft.slideshowEnabled}
              disabled={pending}
              onChange={(event) => update("slideshowEnabled", event.target.checked)}
              type="checkbox"
            />
            <span><strong>Homepage slideshow</strong><small>Show when in schedule</small></span>
          </label>
          <label className="admin-campaign-toggle">
            <input
              checked={draft.popupEnabled}
              disabled={pending}
              onChange={(event) => update("popupEnabled", event.target.checked)}
              type="checkbox"
            />
            <span><strong>Promotional popup</strong><small>Show when in schedule</small></span>
          </label>
        </div>

        <div className="admin-campaign-field-grid">
          <label className="form-field">
            <span>Start date and time (Ghana)</span>
            <input
              disabled={pending}
              onChange={(event) => update("startAt", event.target.value)}
              type="datetime-local"
              value={draft.startAt}
            />
          </label>
          <label className="form-field">
            <span>End date and time (Ghana)</span>
            <input
              disabled={pending}
              onChange={(event) => update("endAt", event.target.value)}
              type="datetime-local"
              value={draft.endAt}
            />
          </label>
          <label className="form-field">
            <span>Priority</span>
            <input
              disabled={pending}
              max="10000"
              min="0"
              onChange={(event) => update("priority", event.target.value)}
              required
              type="number"
              value={draft.priority}
            />
          </label>
          <label className="form-field">
            <span>Popup frequency</span>
            <select
              disabled={pending}
              onChange={(event) => update("popupFrequency", event.target.value)}
              value={draft.popupFrequency}
            >
              <option value="EVERY_VISIT">Every eligible visit</option>
              <option value="ONCE_PER_SESSION">Once per session</option>
              <option value="ONCE_PER_CUSTOMER">Once per customer/browser</option>
            </select>
          </label>
          <label className="form-field admin-campaign-form__destination">
            <span>Internal destination</span>
            <input
              disabled={pending}
              onChange={(event) => update("destinationPath", event.target.value)}
              placeholder="/menu"
              required
              type="text"
              value={draft.destinationPath}
            />
          </label>
          <label className="form-field admin-campaign-form__destination">
            <span>Desktop image path</span>
            <input
              disabled={pending}
              onChange={(event) => update("desktopImagePath", event.target.value)}
              placeholder="/images/promotions/campaign.png"
              required
              type="text"
              value={draft.desktopImagePath}
            />
          </label>
          <label className="form-field">
            <span>Desktop image width</span>
            <input
              disabled={pending}
              max="10000"
              min="1"
              onChange={(event) => update("desktopImageWidth", event.target.value)}
              required
              type="number"
              value={draft.desktopImageWidth}
            />
          </label>
          <label className="form-field">
            <span>Desktop image height</span>
            <input
              disabled={pending}
              max="10000"
              min="1"
              onChange={(event) => update("desktopImageHeight", event.target.value)}
              required
              type="number"
              value={draft.desktopImageHeight}
            />
          </label>
          <label className="form-field admin-campaign-form__destination">
            <span>Mobile image path (optional)</span>
            <input
              disabled={pending}
              onChange={(event) => update("mobileImagePath", event.target.value)}
              placeholder="/images/promotions/campaign-mobile.png"
              type="text"
              value={draft.mobileImagePath || ""}
            />
          </label>
          <label className="form-field">
            <span>Mobile image width (optional)</span>
            <input
              disabled={pending}
              max="10000"
              min="1"
              onChange={(event) => update("mobileImageWidth", event.target.value)}
              type="number"
              value={draft.mobileImageWidth || ""}
            />
          </label>
          <label className="form-field">
            <span>Mobile image height (optional)</span>
            <input
              disabled={pending}
              max="10000"
              min="1"
              onChange={(event) => update("mobileImageHeight", event.target.value)}
              type="number"
              value={draft.mobileImageHeight || ""}
            />
          </label>
        </div>

        <p
          aria-live="polite"
          className={feedback.ok === false ? "admin-inline-error" : "admin-operations-feedback"}
          role="status"
        >
          {feedback.message}
        </p>
        <div className="admin-campaign-form__actions">
          <button className="button-link button-link--primary" disabled={pending} type="submit">
            {pending ? "Saving…" : "Save Campaign"}
          </button>
        </div>
      </form>
    </article>
  );
}

export default function AdminCampaignManager({ initialCampaigns }) {
  const router = useRouter();

  if (!initialCampaigns.length) {
    return (
      <div className="admin-empty-state">
        <h2>No campaigns configured</h2>
        <p>Add a trusted campaign record before enabling promotional placements.</p>
      </div>
    );
  }

  return (
    <div className="admin-campaign-list">
      {initialCampaigns.map((campaign) => (
        <CampaignEditor campaign={campaign} key={campaign.id} onSaved={() => router.refresh()} />
      ))}
    </div>
  );
}
