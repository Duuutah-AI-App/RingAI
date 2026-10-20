import { expect, test, type Page } from "@playwright/test";
import { mockApi } from "./support/mock-api";

// Phone-width regression checks for the dashboard. Set E2E_SCREENSHOT_DIR to
// also save a full-page screenshot of every page visited.

const DASHBOARD_PAGES = [
  { path: "/dashboard", heading: "Dashboard" },
  { path: "/dashboard/calls", heading: "Calls" },
  { path: "/dashboard/menu", heading: "Menu" },
  { path: "/dashboard/orders", heading: "Orders" },
  { path: "/dashboard/reservations", heading: "Reservations" },
  { path: "/dashboard/learning", heading: "AI Learning" },
  { path: "/dashboard/integrations", heading: "Integrations" },
  { path: "/dashboard/billing", heading: "Billing" },
  { path: "/dashboard/settings", heading: "Settings" },
];

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

async function gotoDashboard(page: Page, path: string, heading: string) {
  await page.goto(path);
  await expect(page.getByRole("banner").getByRole("heading", { name: heading })).toBeVisible();
  // Let data-driven content and entrance animations settle.
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(400);
}

/** Widest element extent vs viewport — anything > 0 is a sideways scroll. */
async function horizontalOverflow(page: Page) {
  return page.evaluate(() => {
    const scrollers = [document.documentElement, document.body, document.querySelector("main")].filter(
      (el): el is HTMLElement => !!el,
    );
    return Math.max(0, ...scrollers.map((el) => el.scrollWidth - el.clientWidth));
  });
}

async function mainWidth(page: Page) {
  return page.locator("main").evaluate((el) => el.getBoundingClientRect().width);
}

async function maybeScreenshot(page: Page, name: string) {
  const dir = process.env.E2E_SCREENSHOT_DIR;
  if (dir) await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
}

for (const { path, heading } of DASHBOARD_PAGES) {
  test(`${path} fits a 390px screen without sideways scroll`, async ({ page }) => {
    await gotoDashboard(page, path, heading);
    await maybeScreenshot(page, path.replace(/^\//, "").replace(/\//g, "-"));
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);
    expect(await mainWidth(page)).toBeGreaterThanOrEqual(page.viewportSize()!.width - 1);
  });
}

test.describe("mobile navigation drawer", () => {
  const drawer = (page: Page) => page.getByRole("dialog", { name: "Navigation" });

  test("overlays the page instead of squeezing it", async ({ page }) => {
    await gotoDashboard(page, "/dashboard/calls", "Calls");
    const before = await mainWidth(page);
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(drawer(page)).toBeVisible();
    await maybeScreenshot(page, "drawer-open");
    expect(await mainWidth(page)).toBe(before);
    // Background is scroll-locked while the drawer is open.
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe("hidden");
  });

  test("closes after navigating", async ({ page }) => {
    await gotoDashboard(page, "/dashboard", "Dashboard");
    await page.getByRole("button", { name: "Open navigation" }).click();
    await drawer(page).getByRole("link", { name: "Orders" }).click();
    await expect(page).toHaveURL(/\/dashboard\/orders$/);
    await expect(drawer(page)).toBeHidden();
    await expect(page.getByRole("banner").getByRole("heading", { name: "Orders" })).toBeVisible();
  });

  test("closes on Escape and on backdrop tap", async ({ page }) => {
    await gotoDashboard(page, "/dashboard", "Dashboard");
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(drawer(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer(page)).toBeHidden();

    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(drawer(page)).toBeVisible();
    await page.mouse.click(370, 400); // right of the 256px drawer = backdrop
    await expect(drawer(page)).toBeHidden();
  });
});

test("orders render as readable cards on phones", async ({ page }) => {
  await gotoDashboard(page, "/dashboard/orders", "Orders");
  const cards = page.getByTestId("order-card");
  await expect(cards.first()).toBeVisible();
  // Each card keeps its total and date fully inside the card.
  for (const card of await cards.all()) {
    const box = (await card.boundingBox())!;
    for (const part of ["order-total", "order-date"]) {
      const b = (await card.getByTestId(part).boundingBox())!;
      expect(b.x).toBeGreaterThanOrEqual(box.x);
      expect(b.x + b.width).toBeLessThanOrEqual(box.x + box.width + 0.5);
    }
  }
});

test("menu toolbar actions are all on screen", async ({ page }) => {
  await gotoDashboard(page, "/dashboard/menu", "Menu");
  const vw = page.viewportSize()!.width;
  for (const name of ["Sync from POS", "Import Menu", "Add Item"]) {
    const box = (await page.getByRole("button", { name }).first().boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(vw);
  }
});

test("calls date filters are labelled and full width", async ({ page }) => {
  await gotoDashboard(page, "/dashboard/calls", "Calls");
  for (const label of ["From date", "To date"]) {
    const box = (await page.getByLabel(label).boundingBox())!;
    expect(box.width).toBeGreaterThan(120);
  }
});

test("upgrade links navigate without a full page reload", async ({ page }) => {
  await gotoDashboard(page, "/dashboard/learning", "AI Learning");
  await page.evaluate(() => ((window as unknown as { __spaMarker: boolean }).__spaMarker = true));
  await page.getByRole("link", { name: /Upgrade to Pro/ }).click();
  await expect(page).toHaveURL(/\/dashboard\/billing$/);
  expect(await page.evaluate(() => (window as unknown as { __spaMarker?: boolean }).__spaMarker)).toBe(true);
});
