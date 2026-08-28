"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { formatGhs } from "@/lib/cart/domain";
import { MENU_ADMIN_ACTION } from "@/lib/menu/admin-validation";

function formPayload(form, booleanFields = []) {
  const payload = Object.fromEntries(new FormData(form));

  for (const field of booleanFields) {
    payload[field] = Boolean(form.elements.namedItem(field)?.checked);
  }

  return payload;
}

function Status({ state }) {
  return (
    <p
      aria-live="polite"
      className={state.ok === false ? "admin-inline-error" : "admin-menu-status"}
    >
      {state.message}
    </p>
  );
}

function CategoryForm({ category, onSubmit, pending }) {
  const isCreate = !category;

  return (
    <form
      className="admin-menu-form admin-menu-form--category"
      onSubmit={(event) =>
        onSubmit(
          event,
          isCreate
            ? MENU_ADMIN_ACTION.CATEGORY_CREATE
            : MENU_ADMIN_ACTION.CATEGORY_UPDATE,
          ["active"]
        )
      }
    >
      {category ? <input name="id" type="hidden" value={category.id} /> : null}
      <label className="form-field">
        <span>Category name</span>
        <input defaultValue={category?.name || ""} maxLength="80" name="name" required />
      </label>
      <label className="form-field admin-menu-form__wide">
        <span>Description</span>
        <textarea
          defaultValue={category?.description || ""}
          maxLength="300"
          name="description"
          rows="2"
        />
      </label>
      <label className="form-field">
        <span>Display order</span>
        <input
          defaultValue={category?.sortOrder ?? 0}
          min="0"
          name="sortOrder"
          required
          type="number"
        />
      </label>
      <label className="admin-menu-checkbox">
        <input defaultChecked={category?.active ?? true} name="active" type="checkbox" />
        <span>Visible category</span>
      </label>
      <button className="button-link button-link--primary" disabled={pending} type="submit">
        {pending ? "Saving…" : isCreate ? "Create Category" : "Save Category"}
      </button>
      {category ? (
        <p className="admin-menu-form__hint">
          {category.itemCount} item{category.itemCount === 1 ? "" : "s"}. Archiving hides the
          category and its items publicly without deleting them.
        </p>
      ) : null}
    </form>
  );
}

function ItemFields({ categories, item }) {
  return (
    <>
      {item ? <input name="id" type="hidden" value={item.id} /> : null}
      <label className="form-field">
        <span>Name</span>
        <input defaultValue={item?.name || ""} maxLength="100" name="name" required />
      </label>
      <label className="form-field">
        <span>Category</span>
        <select defaultValue={item?.categoryId || ""} name="categoryId" required>
          <option disabled value="">Select a category</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}{category.active ? "" : " (archived)"}
            </option>
          ))}
        </select>
      </label>
      <label className="form-field admin-menu-form__wide">
        <span>Description</span>
        <textarea
          defaultValue={item?.description || ""}
          maxLength="800"
          name="description"
          required
          rows="3"
        />
      </label>
      <label className="form-field">
        <span>Price (GH₵)</span>
        <input
          defaultValue={item?.priceCedis || ""}
          inputMode="decimal"
          name="priceCedis"
          placeholder="25.00"
          required
        />
      </label>
      <label className="form-field">
        <span>Display order</span>
        <input defaultValue={item?.sortOrder ?? 0} min="0" name="sortOrder" required type="number" />
      </label>
      <label className="form-field">
        <span>Preparation time (minutes)</span>
        <input
          defaultValue={item?.preparationMinutes ?? ""}
          max="1440"
          min="0"
          name="preparationMinutes"
          type="number"
        />
      </label>
      <label className="form-field admin-menu-form__wide">
        <span>Dietary or food notes</span>
        <textarea
          defaultValue={item?.dietaryNotes || ""}
          maxLength="300"
          name="dietaryNotes"
          rows="2"
        />
      </label>
      <div className="admin-menu-state-options admin-menu-form__wide">
        <label className="admin-menu-checkbox">
          <input defaultChecked={item?.available ?? true} name="available" type="checkbox" />
          <span>Available for ordering</span>
        </label>
        <label className="admin-menu-checkbox">
          <input defaultChecked={item?.active ?? true} name="active" type="checkbox" />
          <span>Visible on public menu</span>
        </label>
        <label className="admin-menu-checkbox">
          <input defaultChecked={item?.featured ?? false} name="featured" type="checkbox" />
          <span>Featured</span>
        </label>
      </div>
    </>
  );
}

function ImageManager({ item, mutate, pending }) {
  return (
    <section className="admin-menu-images" aria-labelledby={`images-${item.id}`}>
      <div>
        <p className="admin-section-eyebrow">Images</p>
        <h4 id={`images-${item.id}`}>Image gallery</h4>
        <p>
          Use an existing project image path under <code>/images/</code>. Production uploads
          require a future storage-provider integration.
        </p>
      </div>

      {item.images.length ? (
        <div className="admin-menu-image-grid">
          {item.images.map((image) => (
            <article className="admin-menu-image-card" key={image.id}>
              <Image alt={image.altText} height={180} src={image.imageUrl} width={240} />
              <form
                className="admin-menu-image-form"
                onSubmit={(event) =>
                  mutate(event, MENU_ADMIN_ACTION.IMAGE_UPDATE, ["isPrimary"])
                }
              >
                <input name="id" type="hidden" value={image.id} />
                <input name="menuItemId" type="hidden" value={item.id} />
                <label className="form-field">
                  <span>Image path</span>
                  <input defaultValue={image.imageUrl} name="imageUrl" required />
                </label>
                <label className="form-field">
                  <span>Alternative text</span>
                  <input defaultValue={image.altText} maxLength="160" name="altText" required />
                </label>
                <label className="form-field">
                  <span>Image order</span>
                  <input defaultValue={image.sortOrder} min="0" name="sortOrder" required type="number" />
                </label>
                <label className="admin-menu-checkbox">
                  <input defaultChecked={image.isPrimary} name="isPrimary" type="checkbox" />
                  <span>Primary image</span>
                </label>
                <div className="admin-menu-image-actions">
                  <button className="button-link button-link--secondary" disabled={pending} type="submit">
                    Update Image
                  </button>
                  <button
                    className="cart-text-button"
                    disabled={pending}
                    onClick={() =>
                      mutate(null, MENU_ADMIN_ACTION.IMAGE_REMOVE, [], {
                        id: image.id,
                        menuItemId: item.id,
                      })
                    }
                    type="button"
                  >
                    Remove Image
                  </button>
                </div>
              </form>
            </article>
          ))}
        </div>
      ) : (
        <p className="admin-empty-state">No images have been added to this item.</p>
      )}

      <form
        className="admin-menu-form admin-menu-form--image"
        onSubmit={(event) => mutate(event, MENU_ADMIN_ACTION.IMAGE_ADD, ["isPrimary"])}
      >
        <input name="menuItemId" type="hidden" value={item.id} />
        <input name="sortOrder" type="hidden" value="0" />
        <label className="form-field">
          <span>New image path</span>
          <input name="imageUrl" placeholder="/images/food/example.png" required />
        </label>
        <label className="form-field">
          <span>Alternative text</span>
          <input maxLength="160" name="altText" required />
        </label>
        <label className="admin-menu-checkbox">
          <input name="isPrimary" type="checkbox" />
          <span>Make primary</span>
        </label>
        <button className="button-link button-link--secondary" disabled={pending} type="submit">
          Add Image
        </button>
      </form>
    </section>
  );
}

export default function AdminMenuManager({ categories, items }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [state, setState] = useState({ ok: null, message: "" });
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState("");

  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return items.filter((item) => {
      if (categoryFilter && item.categoryId !== categoryFilter) {
        return false;
      }

      if (availabilityFilter === "available" && !item.available) {
        return false;
      }

      if (availabilityFilter === "unavailable" && item.available) {
        return false;
      }

      if (availabilityFilter === "hidden" && item.active) {
        return false;
      }

      return (
        !normalizedSearch ||
        item.name.toLowerCase().includes(normalizedSearch) ||
        item.description.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [availabilityFilter, categoryFilter, items, search]);

  async function mutate(event, action, booleanFields = [], directPayload = null) {
    event?.preventDefault();
    const submittedForm = event?.currentTarget || null;
    setPending(true);
    setState({ ok: null, message: "" });

    const payload = directPayload
      ? { ...directPayload, action }
      : {
          ...formPayload(event.currentTarget, booleanFields),
          action,
        };

    try {
      const response = await fetch("/api/admin/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      setState({
        ok: response.ok && result.ok,
        message: result.message || "The menu could not be updated.",
      });

      if (response.ok && result.ok) {
        if (submittedForm && action.toString().endsWith("CREATE")) {
          submittedForm.reset();
        }
        router.refresh();
      }
    } catch {
      setState({
        ok: false,
        message: "The menu could not be updated. Check your connection.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="admin-menu-manager">
      <Status state={state} />

      <section className="admin-menu-panel" aria-labelledby="category-management-title">
        <div className="admin-menu-panel__heading">
          <div>
            <p className="admin-section-eyebrow">Catalogue structure</p>
            <h2 id="category-management-title">Categories</h2>
          </div>
          <p>Archive categories without deleting their menu items.</p>
        </div>
        <details className="admin-menu-disclosure">
          <summary>Create category</summary>
          <CategoryForm onSubmit={mutate} pending={pending} />
        </details>
        <div className="admin-menu-category-list">
          {categories.map((category) => (
            <details className="admin-menu-disclosure" key={category.id}>
              <summary>
                <span>{category.name}</span>
                <span>{category.active ? "Visible" : "Archived"}</span>
              </summary>
              <CategoryForm category={category} onSubmit={mutate} pending={pending} />
            </details>
          ))}
        </div>
      </section>

      <section className="admin-menu-panel" aria-labelledby="item-management-title">
        <div className="admin-menu-panel__heading">
          <div>
            <p className="admin-section-eyebrow">Food catalogue</p>
            <h2 id="item-management-title">Menu Items</h2>
          </div>
          <p>Create, edit, archive, restore and manage item images.</p>
        </div>

        <details className="admin-menu-disclosure">
          <summary>Create menu item</summary>
          <form
            className="admin-menu-form"
            onSubmit={(event) =>
              mutate(event, MENU_ADMIN_ACTION.ITEM_CREATE, [
                "available",
                "active",
                "featured",
              ])
            }
          >
            <ItemFields categories={categories} />
            <button className="button-link button-link--primary" disabled={pending} type="submit">
              {pending ? "Saving…" : "Create Menu Item"}
            </button>
          </form>
        </details>

        <div className="admin-menu-filters" role="search">
          <label className="form-field">
            <span>Search</span>
            <input onChange={(event) => setSearch(event.target.value)} type="search" value={search} />
          </label>
          <label className="form-field">
            <span>Category</span>
            <select onChange={(event) => setCategoryFilter(event.target.value)} value={categoryFilter}>
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Availability</span>
            <select
              onChange={(event) => setAvailabilityFilter(event.target.value)}
              value={availabilityFilter}
            >
              <option value="">All items</option>
              <option value="available">Available</option>
              <option value="unavailable">Unavailable</option>
              <option value="hidden">Hidden</option>
            </select>
          </label>
        </div>

        <p className="admin-menu-result-count" role="status">
          {filteredItems.length} matching item{filteredItems.length === 1 ? "" : "s"}
        </p>

        <div className="admin-menu-item-list">
          {filteredItems.map((item) => {
            const primaryImage =
              item.images.find((image) => image.isPrimary) || item.images[0];

            return (
              <article className="admin-menu-item" key={item.id}>
                <div className="admin-menu-item__summary">
                  <div className="admin-menu-item__image">
                    {primaryImage ? (
                      <Image
                        alt={primaryImage.altText}
                        height={160}
                        src={primaryImage.imageUrl}
                        width={220}
                      />
                    ) : (
                      <span>No image</span>
                    )}
                  </div>
                  <div>
                    <p className="admin-section-eyebrow">{item.categoryName}</p>
                    <h3>{item.name}</h3>
                    <p>{formatGhs(item.priceMinor)}</p>
                  </div>
                  <div className="admin-menu-item__states">
                    <span>{item.active && item.categoryActive ? "Visible" : "Hidden"}</span>
                    <span>{item.available ? "Available" : "Unavailable"}</span>
                    {item.featured ? <span>Featured</span> : null}
                  </div>
                </div>

                <details className="admin-menu-disclosure admin-menu-disclosure--item">
                  <summary>Edit item and images</summary>
                  <form
                    className="admin-menu-form"
                    onSubmit={(event) =>
                      mutate(event, MENU_ADMIN_ACTION.ITEM_UPDATE, [
                        "available",
                        "active",
                        "featured",
                      ])
                    }
                  >
                    <ItemFields categories={categories} item={item} />
                    <button className="button-link button-link--primary" disabled={pending} type="submit">
                      {pending ? "Saving…" : "Save Menu Item"}
                    </button>
                    <p className="admin-menu-form__hint">
                      Turn off “Visible on public menu” to archive this item safely. Historical
                      order snapshots and references are retained.
                    </p>
                  </form>
                  <ImageManager item={item} mutate={mutate} pending={pending} />
                </details>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
