import type { Page, Route } from "@playwright/test";

// Must match VITE_BACKEND_URL in playwright.config.ts.
export const E2E_API_ORIGIN = "http://api.e2e.test";

const RESTAURANT = {
  id: "rest_e2e",
  name: "Duuutah Staging Test",
  business_type: "restaurant",
  cuisine_type: "mexican",
  is_active: true,
  plan: "STARTER",
  billing_status: "active",
  phone_number: "+15555550123",
};

const CALLERS = ["Tiza", "Nidisha", "Nitisha", "Unknown Caller", "Tisha"];
const ITEMS = [
  { name: "Chicken Burger", quantity: 1, price: 1000 },
  { name: "Coke", quantity: 2, price: 199 },
  { name: "Crispy Potato Wrap", quantity: 1, price: 899 },
];

const orderCall = (i: number) => ({
  id: `call_e2e_${i}`,
  call_sid: `v3:ow1kgokw${i}xyz`,
  restaurant_id: RESTAURANT.id,
  caller_name: CALLERS[i % CALLERS.length],
  caller_number: "+918978616264",
  status: "COMPLETED",
  duration_seconds: 95,
  quality_score: 84,
  started_at: new Date(Date.UTC(2026, 9, 8 - i, 13, 49)).toISOString(),
  order_total: 1300 + i * 250,
  order_json: {
    customer_name: CALLERS[i % CALLERS.length],
    order_type: i % 3 === 0 ? "delivery" : "pickup",
    state: i < 3 ? "DISPATCH_FAILED" : "CONFIRMED",
    dispatch_failure_reason: "POS rejected the order",
    items: ITEMS.slice(0, 1 + (i % 3)),
    total: 1300 + i * 250,
  },
});

const CALLS = Array.from({ length: 8 }, (_, i) => orderCall(i));

const MENU = [
  ["Chicken crunchy taco", "Appetizers", 1000],
  ["Cheesy Seasoned Nachos", "Appetizers", 899],
  ["Cheesy Crispy Fries", "Appetizers", 899],
  ["Margherita", "Pizza", 1499],
  ["Penne Arrabbiata", "Pasta", 1399],
  ["Cinnamon Twists", "Desserts", 699],
  ["Churros & Chocolate", "Desserts", 1099],
  ["Sprite", "Beverages", 199],
  ["Diet Coke", "Beverages", 200],
].map(([name, category, price], i) => ({
  id: `menu_${i}`,
  restaurant_id: RESTAURANT.id,
  name,
  category,
  price,
  description: "",
  is_available: true,
  is_active: true,
}));

const ANALYTICS = {
  total_calls: 8,
  calls_this_week: 0,
  calls_this_month: 8,
  revenue_this_week: 0,
  revenue_this_month: 13300,
  avg_quality_score: 83.8,
  ai_containment_rate: 100,
  escalated_calls: 0,
  recent_calls: CALLS.slice(0, 3),
  top_items: ITEMS.map((it, i) => ({ name: it.name, count: 3 - i })),
  daily_call_data: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => ({ label, calls: 0, revenue: 0 })),
  monthly_call_data: [],
  hourly_distribution: [],
};

type Handler = (url: URL, route: Route) => unknown;

// Order matters: first matching pattern wins.
const GET_ROUTES: Array<[RegExp, Handler]> = [
  [/^\/api\/me\/bootstrap$/, () => ({
    user: { id: "user_e2e", email: "owner@e2e.test" },
    memberships: [{ restaurant_id: RESTAURANT.id, role: "owner" }],
    restaurants: [RESTAURANT],
    active_restaurant: RESTAURANT,
    onboarding_complete: true,
  })],
  [/^\/api\/restaurants\/[^/]+\/config$/, () => ({
    business_type: "restaurant",
    operating_hours: {},
    business_rules: [],
    escalation_rules: [],
  })],
  [/^\/api\/restaurants\/[^/]+\/calls$/, (url) => {
    const status = url.searchParams.get("status");
    const calls = status && status !== "COMPLETED" ? [] : CALLS;
    return { calls, total: calls.length, pages: 1 };
  }],
  [/^\/api\/restaurants\/[^/]+\/menu$/, () => MENU],
  [/^\/api\/restaurants\/[^/]+\/modifier-groups$/, () => []],
  [/^\/api\/restaurants\/[^/]+\/analytics\/summary$/, () => ANALYTICS],
  [/^\/api\/restaurants\/[^/]+\/plan-features$/, () => ({ plan: "STARTER", features: [] })],
  [/^\/api\/restaurants\/[^/]+\/learning\/.*$/, () => ({})],
  [/^\/api\/restaurants\/[^/]+\/reservations.*$/, () => []],
  [/^\/api\/restaurants\/[^/]+\/calendar\/status$/, () => ({ connected: false })],
  [/^\/api\/restaurants\/[^/]+$/, () => RESTAURANT],
  [/^\/api\/billing\/invoices$/, () => []],
  [/^\/api\/telnyx\/numbers\/status$/, () => ({ provisioned: true, phone_number: RESTAURANT.phone_number })],
  [/^\/api\/integrations\/stripe\/status$/, () => ({ connected: false })],
  [/^\/api\/calls\/[^/]+$/, (url) => CALLS.find((c) => url.pathname.endsWith(c.id)) ?? CALLS[0]],
];

/** Fulfil every backend request with deterministic fixtures. Unknown GETs get
 *  an empty object; writes succeed with { ok: true }. */
export async function mockApi(page: Page) {
  await page.route(`${E2E_API_ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    let body: unknown = { ok: true };
    if (route.request().method() === "GET") {
      const match = GET_ROUTES.find(([re]) => re.test(url.pathname));
      body = match ? match[1](url, route) : {};
    }
    await route.fulfill({ json: body });
  });
  // Real-time notifications socket: accept and stay silent.
  await page.routeWebSocket(/^wss?:\/\/api\.e2e\.test\//, () => {});
}
