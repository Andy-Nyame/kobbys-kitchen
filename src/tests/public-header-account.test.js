import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

describe("public authenticated account header", () => {
  it("places one desktop account control after Theme and Cart", async () => {
    const source = await readFile(
      "src/components/layout/SiteHeader.jsx",
      "utf8"
    );
    const themePosition = source.indexOf("<ThemeControl compact />");
    const cartPosition = source.indexOf("<CartLink />");
    const accountPosition = source.indexOf(
      '<ul className="site-header__account-actions">'
    );

    assert.ok(themePosition > -1);
    assert.ok(cartPosition > themePosition);
    assert.ok(accountPosition > cartPosition);
    assert.equal(
      source.match(/className="site-header__account-actions"/g)?.length,
      1
    );
    assert.doesNotMatch(source, /Order Now/);
  });

  it("keeps account actions in the hamburger and Cart directly in the mobile header", async () => {
    const [source, header] = await Promise.all([
      readFile("src/components/navigation/MobileNavigation.jsx", "utf8"),
      readFile("src/components/layout/SiteHeader.jsx", "utf8"),
    ]);

    assert.match(source, /<details className="mobile-navigation">/);
    assert.match(source, /<HeaderAuthNavigation[\s\S]*mobile[\s\S]*navigation=\{authNavigation\}[\s\S]*\/>/);
    assert.match(source, /<CustomerOrdersNavigationLink[\s\S]*mobile[\s\S]*\/>/);
    assert.doesNotMatch(source, /CartLink/);
    assert.match(source, /\["\/account\/orders", "\/cart"\]/);
    assert.match(source, /<ThemeControl className="mobile-navigation__theme" \/>/);
    assert.match(header, /className="site-header__mobile-actions"/);
    assert.match(header, /<CartLink mobileHeader \/>/);
  });

  it("supports keyboard and outside-click account-menu dismissal", async () => {
    const source = await readFile(
      "src/components/navigation/CustomerAccountMenu.jsx",
      "utf8"
    );

    assert.match(source, /aria-label=\{menu\.triggerLabel\}/);
    assert.match(source, /aria-label=\{menu\.navigationLabel\}/);
    assert.match(source, /event\.key !== "Escape"/);
    assert.match(source, /querySelector\("summary"\)\?\.focus\(\)/);
    assert.match(source, /document\.addEventListener\("pointerdown"/);
    assert.match(source, /action="\/api\/auth\/logout"/);
    assert.match(source, />\s*Sign Out\s*</);
  });

  it("refreshes server-rendered identity after a profile save", async () => {
    const source = await readFile(
      "src/components/account/ProfileForm.jsx",
      "utf8"
    );

    assert.match(source, /const router = useRouter\(\)/);
    assert.match(source, /router\.refresh\(\)/);
  });
});
