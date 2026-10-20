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

// Pro-only pages: the default mock is a Starter account (like staging), which
// shows upgrade cards instead of these sections.
test.describe("Pro plan pages", () => {
  test.beforeEach(async ({ page }) => {
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await mockApi(page, { plan: "PRO" });
  });

  test("reservations header gives the title full width and the button its own row", async ({ page }) => {
    await gotoDashboard(page, "/dashboard/reservations", "Reservations");
    await maybeScreenshot(page, "pro-reservations");
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);

    const main = (await page.locator("main").boundingBox())!;
    const title = (await page.getByRole("heading", { level: 1, name: "Reservations" }).boundingBox())!;
    const description = (await page.getByText(/^Manage table reservations for/).boundingBox())!;
    const button = page.getByTestId("create-reservation-btn");
    const btn = (await button.boundingBox())!;

    // Description is no longer squeezed into a narrow column beside the button.
    expect(description.width).toBeGreaterThan(main.width * 0.6);
    // Button sits below the heading block, fully on screen.
    expect(btn.y).toBeGreaterThanOrEqual(description.y + description.height - 1);
    expect(btn.x).toBeGreaterThanOrEqual(main.x);
    expect(btn.x + btn.width).toBeLessThanOrEqual(main.x + main.width + 0.5);
    expect(title.x).toBeLessThan(btn.x + 1);

    // Still opens the existing create dialog.
    await button.click();
    await expect(page.getByRole("dialog", { name: "Create Reservation" })).toBeVisible();
  });

  test("AI Learning review actions stay inside each review card", async ({ page }) => {
    await gotoDashboard(page, "/dashboard/learning", "AI Learning");
    await maybeScreenshot(page, "pro-ai-learning");
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1);

    const cards = page.locator('[data-testid^="flagged-call-"]');
    await expect(cards).toHaveCount(3);
    for (const card of await cards.all()) {
      const box = (await card.boundingBox())!;
      for (const name of ["AI was correct", "AI made a mistake"]) {
        const b = (await card.getByRole("button", { name }).boundingBox())!;
        expect(b.x).toBeGreaterThanOrEqual(box.x);
        expect(b.x + b.width).toBeLessThanOrEqual(box.x + box.width + 0.5);
      }
      // Score and date remain visible; long summaries truncate instead of overflowing.
      await expect(card.getByText(/^Score: \d+$/)).toBeVisible();
    }

    // Reject still calls the same review endpoint with the same payload.
    const req = page.waitForRequest(
      (r) => r.method() === "POST" && r.url().endsWith("/api/learning/flagged-calls/flag_0/review"),
    );
    await page.getByTestId("flagged-call-flag_0").getByRole("button", { name: "AI made a mistake" }).click();
    expect((await req).postDataJSON()).toEqual({ action: "incorrect" });
  });
});
