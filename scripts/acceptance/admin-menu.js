import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { prisma } from "../../src/lib/prisma.js";
import { verifyDevelopmentDatabase } from "../database-safety.js";

const baseUrl = process.env.AUTH_URL || "http://localhost:3000";
const suffix = `${Date.now()}-${randomBytes(4).toString("hex")}`;
const email = `admin-menu-acceptance-${suffix}@example.invalid`;
const password = `Aa!${randomBytes(12).toString("hex")}`;
const itemName = `Admin Menu Acceptance ${suffix}`;
const screenshotPrefix = join(tmpdir(), `kobbys-admin-menu-${suffix}`);
const chromeProfile = join(tmpdir(), `kobbys-admin-menu-chrome-${suffix}`);
const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const cookieJar = new Map();
const result = { signedOut: {}, customer: {}, admin: {}, browser: {} };
let userId = null;
let categoryId = null;
let itemId = null;
let chrome = null;

function updateCookies(response, jar) {
  for (const value of response.headers.getSetCookie?.() || []) {
    const pair = value.split(";", 1)[0];
    const separator = pair.indexOf("=");
    const name = pair.slice(0, separator);
    const cookieValue = pair.slice(separator + 1);

    if (!cookieValue || /max-age=0/i.test(value)) {
      jar.delete(name);
    } else {
      jar.set(name, cookieValue);
    }
  }
}

async function request(path, options = {}, jar = new Map()) {
  const headers = new Headers(options.headers || {});

  if (jar.size > 0) {
    headers.set(
      "Cookie",
      [...jar].map(([name, value]) => `${name}=${value}`).join("; ")
    );
  }

  const response = await fetch(new URL(path, baseUrl), {
    ...options,
    headers,
    redirect: "manual",
  });
  updateCookies(response, jar);
  return response;
}

async function jsonRequest(path, body, jar = new Map(), method = "POST") {
  return request(
    path,
    {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    jar
  );
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function openChrome() {
  chrome = spawn(
    chromePath,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--remote-debugging-port=9223",
      `--user-data-dir=${chromeProfile}`,
      "about:blank",
    ],
    { stdio: "ignore" }
  );

  let version = null;

  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch("http://127.0.0.1:9223/json/version");
      version = await response.json();
      break;
    } catch {
      await wait(100);
    }
  }

  assert.ok(version, "Headless Chrome did not expose its development endpoint.");
  const targets = await fetch("http://127.0.0.1:9223/json/list").then((response) =>
    response.json()
  );
  const target = targets.find((entry) => entry.type === "page");
  assert.ok(target?.webSocketDebuggerUrl);

  const socket = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  let nextId = 0;
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    const handler = pending.get(message.id);

    if (handler) {
      pending.delete(message.id);
      if (message.error) {
        handler.reject(new Error(message.error.message));
      } else {
        handler.resolve(message.result);
      }
    }
  });

  function send(method, params = {}) {
    nextId += 1;
    socket.send(JSON.stringify({ id: nextId, method, params }));
    return new Promise((resolve, reject) => {
      pending.set(nextId, { resolve, reject });
    });
  }

  await Promise.all([send("Page.enable"), send("Runtime.enable"), send("Network.enable")]);
  for (const [name, value] of cookieJar) {
    const cookie = await send("Network.setCookie", { name, value, url: baseUrl });
    assert.equal(cookie.success, true);
  }

  return { send, socket };
}

async function evaluate(send, expression) {
  const response = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });

  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.text || "Browser evaluation failed.");
  }

  return response.result.value;
}

async function navigate(send, path) {
  await send("Page.navigate", { url: new URL(path, baseUrl).href });

  for (let attempt = 0; attempt < 80; attempt += 1) {
    const ready = await evaluate(
      send,
      "document.readyState === 'complete' && Boolean(document.querySelector('main'))"
    );
    if (ready) {
      await wait(250);
      return;
    }
    await wait(100);
  }

  throw new Error(`Browser navigation did not complete for ${path}.`);
}

try {
  await verifyDevelopmentDatabase();
  assert.equal(process.env.V2_ORDERING_ENABLED, "false");

  const signedOutPage = await request("/admin/menu");
  result.signedOut.page = signedOutPage.status;
  assert.ok([302, 303, 307, 308].includes(signedOutPage.status));
  const signedOutMutation = await jsonRequest("/api/admin/menu", {
    action: "CATEGORY_CREATE",
  });
  result.signedOut.mutation = signedOutMutation.status;
  assert.equal(signedOutMutation.status, 401);

  const signup = await jsonRequest("/api/auth/signup", {
    displayName: "Admin Menu Acceptance",
    email,
    phone: "020 123 4567",
    password,
  });
  assert.equal(signup.status, 201);
  const user = await prisma.user.findUnique({ where: { email } });
  assert.equal(user.role, "CUSTOMER");
  userId = user.id;

  const customerJar = new Map();
  const customerLogin = await jsonRequest(
    "/api/auth/login",
    { email, password },
    customerJar
  );
  assert.equal(customerLogin.status, 200);
  const customerPage = await request("/admin/menu", {}, customerJar);
  result.customer.page = customerPage.status;
  assert.ok([302, 303, 307, 308].includes(customerPage.status));
  const customerMutation = await jsonRequest(
    "/api/admin/menu",
    { action: "CATEGORY_CREATE" },
    customerJar
  );
  result.customer.mutation = customerMutation.status;
  assert.equal(customerMutation.status, 403);
  await request("/api/auth/logout", { method: "POST" }, customerJar);

  await prisma.user.update({ where: { id: userId }, data: { role: "ADMIN" } });
  const adminLogin = await jsonRequest(
    "/api/auth/admin-login",
    { email, password, next: "/admin/menu" },
    cookieJar
  );
  assert.equal(adminLogin.status, 200);

  const categoryResponse = await jsonRequest(
    "/api/admin/menu",
    {
      action: "CATEGORY_CREATE",
      name: `Acceptance Category ${suffix}`,
      description: "Disposable browser acceptance category.",
      sortOrder: 9990,
      active: true,
    },
    cookieJar
  );
  assert.equal(categoryResponse.status, 200);
  categoryId = (await categoryResponse.json()).result.id;

  const itemResponse = await jsonRequest(
    "/api/admin/menu",
    {
      action: "ITEM_CREATE",
      categoryId,
      name: itemName,
      description: "Disposable browser acceptance menu item.",
      priceCedis: "31.00",
      available: true,
      active: true,
      featured: true,
      sortOrder: 9990,
      preparationMinutes: 15,
      dietaryNotes: "Acceptance test only",
    },
    cookieJar
  );
  assert.equal(itemResponse.status, 200);
  itemId = (await itemResponse.json()).result.id;

  for (const [imageUrl, altText, isPrimary] of [
    ["/images/food/jollof-rice.png", "Acceptance meal cover", true],
    ["/images/food/fried-rice.png", "Acceptance meal alternate", false],
  ]) {
    const imageResponse = await jsonRequest(
      "/api/admin/menu",
      {
        action: "IMAGE_ADD",
        menuItemId: itemId,
        imageUrl,
        altText,
        sortOrder: 0,
        isPrimary,
      },
      cookieJar
    );
    assert.equal(imageResponse.status, 200);
  }

  let images = await prisma.menuItemImage.findMany({
    where: { menuItemId: itemId },
    orderBy: { sortOrder: "asc" },
  });
  assert.equal(images.length, 2);
  assert.equal(images.filter((image) => image.isPrimary).length, 1);
  const secondary = images.find((image) => !image.isPrimary);
  const reorder = await jsonRequest(
    "/api/admin/menu",
    {
      action: "IMAGE_UPDATE",
      id: secondary.id,
      menuItemId: itemId,
      imageUrl: secondary.imageUrl,
      altText: secondary.altText,
      sortOrder: 0,
      isPrimary: true,
    },
    cookieJar
  );
  assert.equal(reorder.status, 200);
  images = await prisma.menuItemImage.findMany({
    where: { menuItemId: itemId },
    orderBy: { sortOrder: "asc" },
  });
  assert.equal(images[0].id, secondary.id);
  assert.equal(images.filter((image) => image.isPrimary).length, 1);

  const removePrimary = await jsonRequest(
    "/api/admin/menu",
    { action: "IMAGE_REMOVE", id: secondary.id, menuItemId: itemId },
    cookieJar
  );
  assert.equal(removePrimary.status, 200);
  images = await prisma.menuItemImage.findMany({ where: { menuItemId: itemId } });
  assert.equal(images.length, 1);
  assert.equal(images[0].isPrimary, true);
  assert.equal(images[0].sortOrder, 0);

  const unavailable = await jsonRequest(
    "/api/admin/menu",
    {
      action: "ITEM_UPDATE",
      id: itemId,
      categoryId,
      name: itemName,
      description: "Disposable browser acceptance menu item.",
      priceCedis: "31.00",
      available: false,
      active: true,
      featured: true,
      sortOrder: 9990,
      preparationMinutes: 15,
      dietaryNotes: "Acceptance test only",
    },
    cookieJar
  );
  assert.equal(unavailable.status, 200);
  const publicUnavailable = await request("/menu");
  const publicUnavailableHtml = await publicUnavailable.text();
  assert.match(publicUnavailableHtml, new RegExp(itemName));
  assert.match(publicUnavailableHtml, /Unavailable/);

  const adminPage = await request("/admin/menu", {}, cookieJar);
  const adminHtml = await adminPage.text();
  result.admin.page = adminPage.status;
  assert.equal(adminPage.status, 200);
  assert.match(adminHtml, /Menu Management/);
  assert.match(adminHtml, new RegExp(itemName));

  const { send, socket } = await openChrome();
  try {
    await navigate(send, "/admin/menu");
    await evaluate(
      send,
      `(() => {
        localStorage.setItem('kobbys-kitchen-theme', 'light');
        document.documentElement.dataset.themePreference = 'light';
        document.documentElement.dataset.theme = 'light';
        document.documentElement.style.colorScheme = 'light';
      })()`
    );
    for (const width of [320, 390, 768, 1024, 1440]) {
      await send("Emulation.setDeviceMetricsOverride", {
        width,
        height: width < 800 ? 900 : 1000,
        deviceScaleFactor: 1,
        mobile: width < 800,
      });
      await navigate(send, "/admin/menu");
      const diagnostics = await evaluate(
        send,
        `(() => ({
          path: location.pathname,
          title: document.querySelector('h1')?.textContent,
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          sidebarDisplay: getComputedStyle(document.querySelector('.admin-sidebar')).display,
          mobileHeaderDisplay: getComputedStyle(document.querySelector('.admin-mobile-header')).display,
          menuCurrent: document.querySelector('a[href="/admin/menu"]')?.getAttribute('aria-current'),
          itemPresent: document.body.textContent.includes(${JSON.stringify(itemName)}),
          theme: document.documentElement.dataset.theme,
          categoryInputs: document.querySelectorAll('.admin-menu-form--category input').length,
          itemForms: document.querySelectorAll('.admin-menu-disclosure--item form').length
        }))()`
      );
      assert.equal(diagnostics.path, "/admin/menu");
      assert.equal(diagnostics.title, "Menu Management");
      assert.equal(diagnostics.overflow, false);
      assert.equal(diagnostics.menuCurrent, "page");
      assert.equal(diagnostics.itemPresent, true);
      assert.equal(diagnostics.theme, "light");
      if (width < 1024) {
        assert.equal(diagnostics.sidebarDisplay, "none");
        assert.notEqual(diagnostics.mobileHeaderDisplay, "none");
      } else {
        assert.notEqual(diagnostics.sidebarDisplay, "none");
        assert.equal(diagnostics.mobileHeaderDisplay, "none");
      }
      result.browser[width] = diagnostics;
      const screenshot = await send("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: false,
      });
      await writeFile(`${screenshotPrefix}-${width}.png`, Buffer.from(screenshot.data, "base64"));
    }

    const itemEditorOpened = await evaluate(
      send,
      `(() => {
        const item = [...document.querySelectorAll('.admin-menu-item')]
          .find((entry) => entry.textContent.includes(${JSON.stringify(itemName)}));
        const disclosure = item?.querySelector('.admin-menu-disclosure--item');
        if (!disclosure) return false;
        disclosure.open = true;
        disclosure.scrollIntoView({ block: 'start' });
        return true;
      })()`
    );
    assert.equal(itemEditorOpened, true);
    const itemScreenshot = await send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
    });
    await writeFile(
      `${screenshotPrefix}-1440-item-editor-light.png`,
      Buffer.from(itemScreenshot.data, "base64")
    );

    await evaluate(
      send,
      `(() => {
        localStorage.setItem('kobbys-kitchen-theme', 'dark');
        document.documentElement.dataset.themePreference = 'dark';
        document.documentElement.dataset.theme = 'dark';
        document.documentElement.style.colorScheme = 'dark';
      })()`
    );
    assert.equal(
      await evaluate(send, "document.documentElement.dataset.theme"),
      "dark"
    );
    await evaluate(send, "window.scrollTo(0, 0)");
    const darkScreenshot = await send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
    });
    await writeFile(
      `${screenshotPrefix}-1440-dark.png`,
      Buffer.from(darkScreenshot.data, "base64")
    );
    await send("Emulation.setDeviceMetricsOverride", {
      width: 390,
      height: 900,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await navigate(send, "/admin/menu");
    assert.equal(
      await evaluate(
        send,
        "document.documentElement.dataset.theme === 'dark' && document.documentElement.scrollWidth <= document.documentElement.clientWidth"
      ),
      true
    );
    const mobileDarkScreenshot = await send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
    });
    await writeFile(
      `${screenshotPrefix}-390-dark.png`,
      Buffer.from(mobileDarkScreenshot.data, "base64")
    );
    result.browser.screenshots = [
      ...[320, 390, 768, 1024, 1440].map(
        (width) => `${screenshotPrefix}-${width}.png`
      ),
      `${screenshotPrefix}-1440-item-editor-light.png`,
      `${screenshotPrefix}-1440-dark.png`,
      `${screenshotPrefix}-390-dark.png`,
    ];
  } finally {
    socket.close();
  }

  console.log(JSON.stringify({ ok: true, ...result }));
} finally {
  if (chrome) {
    chrome.kill("SIGTERM");
  }
  if (itemId) {
    await prisma.menuItem.deleteMany({ where: { id: itemId } });
  }
  if (categoryId) {
    await prisma.menuCategory.deleteMany({ where: { id: categoryId } });
  }
  if (userId) {
    await prisma.user.deleteMany({ where: { id: userId } });
  }
  await prisma.$disconnect();
  await rm(chromeProfile, { recursive: true, force: true });
}
