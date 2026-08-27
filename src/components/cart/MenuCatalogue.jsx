"use client";

import MenuItemCard from "@/components/cart/MenuItemCard";

export default function MenuCatalogue({ categories, items }) {
  return (
    <div className="menu-catalogue">
      {categories.map((category) => {
        const categoryItems = items.filter((item) => item.categoryId === category.id);

        if (categoryItems.length === 0) {
          return null;
        }

        return (
          <section aria-labelledby={`menu-category-${category.slug}`} className="menu-catalogue__category" key={category.id}>
            <div className="menu-catalogue__heading">
              <p className="order-option-card__eyebrow">Menu category</p>
              <h2 id={`menu-category-${category.slug}`}>{category.name}</h2>
            </div>
            <div className="meal-grid">
              {categoryItems.map((item) => (
                <MenuItemCard categoryName={category.name} item={item} key={item.id} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
