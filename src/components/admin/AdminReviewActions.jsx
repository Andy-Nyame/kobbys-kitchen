"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  REVIEW_MODERATION_ACTION,
  REVIEW_STATUS,
} from "@/lib/reviews/moderation";

export default function AdminReviewActions({ review }) {
  const router = useRouter();
  const [state, setState] = useState({ ok: null, message: "" });
  const [pending, setPending] = useState(false);
  const isApproved = review.status === REVIEW_STATUS.APPROVED;

  async function handleSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const action = formData.get("action");

    setPending(true);
    setState({ ok: null, message: "" });

    try {
      const response = await fetch(`/api/admin/reviews/${review.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const result = await response.json();

      setState({
        ok: response.ok && result.ok,
        message: result.message || "The review could not be updated.",
      });

      if (response.ok && result.ok) {
        router.refresh();
      }
    } catch {
      setState({
        ok: false,
        message: "The review could not be updated. Check your connection.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="admin-review-actions" onSubmit={handleSubmit}>
      {!isApproved ? (
        <button
          className="button-link button-link--secondary"
          disabled={pending}
          name="action"
          type="submit"
          value={REVIEW_MODERATION_ACTION.APPROVE}
        >
          Approve
        </button>
      ) : null}
      {review.status !== REVIEW_STATUS.HIDDEN ? (
        <button
          className="button-link button-link--secondary"
          disabled={pending}
          name="action"
          type="submit"
          value={REVIEW_MODERATION_ACTION.HIDE}
        >
          Hide
        </button>
      ) : null}
      {isApproved && !review.featured ? (
        <button
          className="button-link button-link--primary"
          disabled={pending}
          name="action"
          type="submit"
          value={REVIEW_MODERATION_ACTION.FEATURE}
        >
          Feature
        </button>
      ) : null}
      {review.featured ? (
        <button
          className="button-link button-link--secondary"
          disabled={pending}
          name="action"
          type="submit"
          value={REVIEW_MODERATION_ACTION.UNFEATURE}
        >
          Unfeature
        </button>
      ) : null}
      <span
        aria-live="polite"
        className={state.ok === false ? "admin-inline-error" : "admin-review-actions__status"}
      >
        {pending ? "Updating…" : state.message}
      </span>
    </form>
  );
}
