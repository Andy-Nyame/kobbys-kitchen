"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  PROMO_ADMIN_ACTION,
  serializeMinorToCedis,
  serializePromoDateTime,
  serializePromoDiscountValue,
} from "@/lib/promos/admin-validation";

function createDraft(promo = null) {
  return {
    id: promo?.id || null,
    code: promo?.code || "",
    name: promo?.name || "",
    discountType: promo?.discountType || "PERCENTAGE",
    discountValue: promo ? serializePromoDiscountValue(promo) : "",
    active: promo?.active ?? true,
    startAt: serializePromoDateTime(promo?.startAt),
    endAt: serializePromoDateTime(promo?.endAt),
    minimumSubtotal: serializeMinorToCedis(promo?.minimumSubtotalMinor),
    maximumDiscount: serializeMinorToCedis(promo?.maximumDiscountMinor),
    totalUsageLimit: promo?.totalUsageLimit ?? "",
    perCustomerUsageLimit: promo?.perCustomerUsageLimit ?? "",
    restrictedCustomerId: promo?.restrictedCustomerId || "",
  };
}

function PromoForm({ customers, promo = null }) {
  const router = useRouter();
  const [draft, setDraft] = useState(() => createDraft(promo));
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");
  const update = (field, value) => setDraft((current) => ({ ...current, [field]: value }));

  async function save(event) {
    event.preventDefault();
    setPending(true);
    setFeedback("");
    try {
      const response = await fetch("/api/admin/promos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          action: promo ? PROMO_ADMIN_ACTION.UPDATE : PROMO_ADMIN_ACTION.CREATE,
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) throw new Error(result?.message || "Promo settings could not be saved.");
      setFeedback(result.message);
      if (!promo) setDraft(createDraft());
      router.refresh();
    } catch (error) {
      setFeedback(error.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="admin-promo-form" onSubmit={save}>
      <div className="admin-promo-form__heading">
        <div>
          <p className="order-option-card__eyebrow">{promo ? "Existing promo" : "New promo"}</p>
          <h3>{promo?.code || "Create promo code"}</h3>
        </div>
        {promo ? <span>{promo.claimedUsageCount} claimed · {promo.redeemedUsageCount} redeemed</span> : null}
      </div>
      <div className="admin-promo-grid">
        <label className="form-field"><span>Code</span><input autoCapitalize="characters" maxLength="32" onChange={(event) => update("code", event.target.value)} required value={draft.code} /></label>
        <label className="form-field"><span>Description <small>(optional)</small></span><input maxLength="80" onChange={(event) => update("name", event.target.value)} value={draft.name} /></label>
        <label className="form-field"><span>Discount type</span><select onChange={(event) => update("discountType", event.target.value)} value={draft.discountType}><option value="PERCENTAGE">Percentage</option><option value="FIXED_AMOUNT">Fixed amount</option></select></label>
        <label className="form-field"><span>{draft.discountType === "PERCENTAGE" ? "Percentage (%)" : "Fixed amount (GH₵)"}</span><input inputMode="decimal" min="0.01" onChange={(event) => update("discountValue", event.target.value)} required step="0.01" type="number" value={draft.discountValue} /></label>
        <label className="form-field"><span>Minimum subtotal (GH₵)</span><input inputMode="decimal" min="0" onChange={(event) => update("minimumSubtotal", event.target.value)} step="0.01" type="number" value={draft.minimumSubtotal} /></label>
        <label className="form-field"><span>Maximum discount (GH₵)</span><input disabled={draft.discountType !== "PERCENTAGE"} inputMode="decimal" min="0.01" onChange={(event) => update("maximumDiscount", event.target.value)} step="0.01" type="number" value={draft.maximumDiscount} /></label>
        <label className="form-field"><span>Start <small>(Ghana time)</small></span><input onChange={(event) => update("startAt", event.target.value)} type="datetime-local" value={draft.startAt} /></label>
        <label className="form-field"><span>End <small>(Ghana time)</small></span><input onChange={(event) => update("endAt", event.target.value)} type="datetime-local" value={draft.endAt} /></label>
        <label className="form-field"><span>Total usage limit</span><input inputMode="numeric" min="1" onChange={(event) => update("totalUsageLimit", event.target.value)} type="number" value={draft.totalUsageLimit} /></label>
        <label className="form-field"><span>Per-customer limit</span><input inputMode="numeric" min="1" onChange={(event) => update("perCustomerUsageLimit", event.target.value)} type="number" value={draft.perCustomerUsageLimit} /></label>
        <label className="form-field admin-promo-grid__wide"><span>Customer restriction <small>(optional)</small></span><select onChange={(event) => update("restrictedCustomerId", event.target.value)} value={draft.restrictedCustomerId}><option value="">Available to all customers</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name || customer.email} · {customer.email}</option>)}</select></label>
      </div>
      <label className="admin-campaign-toggle"><input checked={draft.active} onChange={(event) => update("active", event.target.checked)} type="checkbox" /><span><strong>Active</strong><small>Inactive promos cannot be previewed or used.</small></span></label>
      <div className="admin-promo-form__footer">
        <p aria-live="polite" role="status">{feedback}</p>
        <button className="button-link button-link--primary" disabled={pending} type="submit">{pending ? "Saving…" : promo ? "Save Promo" : "Create Promo"}</button>
      </div>
    </form>
  );
}

export default function AdminPromoManager({ customers, initialPromos }) {
  return (
    <div className="admin-promo-list">
      <PromoForm customers={customers} />
      {initialPromos.length ? initialPromos.map((promo) => (
        <PromoForm customers={customers} key={promo.id} promo={promo} />
      )) : <p className="admin-empty-state">No promo codes have been created.</p>}
    </div>
  );
}
