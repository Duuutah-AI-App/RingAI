import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/utils/render";
import SquareCallbackPage from "@/pages/SquareCallbackPage";

const CALLBACK = "/integrations/square/callback";

// The page is display-only: it reads status/merchant_id/reason from the query
// string the backend redirect set and renders success or error. No network, no
// auth, no side effects — so we render it directly inside the MemoryRouter.

describe("SquareCallbackPage", () => {
  it("shows the success state with the merchant id and a back link", () => {
    renderWithProviders(<SquareCallbackPage />, {
      initialEntries: [`${CALLBACK}?status=connected&merchant_id=ABC123`],
    });

    expect(screen.getByText(/Square connected/i)).toBeInTheDocument();
    expect(screen.getByText(/ABC123/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /back to integrations/i })
    ).toHaveAttribute("href", "/dashboard/integrations");
  });

  it("shows the error state with the exchange_failed message", () => {
    renderWithProviders(<SquareCallbackPage />, {
      initialEntries: [`${CALLBACK}?status=error&reason=exchange_failed`],
    });

    expect(screen.getByText(/Square connection failed/i)).toBeInTheDocument();
    expect(
      screen.getByText(/couldn't finish connecting your Square account/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /back to integrations/i })
    ).toHaveAttribute("href", "/dashboard/integrations");
  });

  it("shows no location notice when the location was saved", () => {
    renderWithProviders(<SquareCallbackPage />, {
      initialEntries: [`${CALLBACK}?status=connected&merchant_id=ABC123&location=saved`],
    });

    expect(screen.getByText(/Square connected/i)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("tells a multi-location owner to choose a location instead of guessing", () => {
    renderWithProviders(<SquareCallbackPage />, {
      initialEntries: [`${CALLBACK}?status=connected&merchant_id=ABC123&location=select_required`],
    });

    expect(screen.getByText(/Square connected/i)).toBeInTheDocument();
    const notice = screen.getByRole("alert");
    expect(notice).toHaveTextContent(/more than one location/i);
    expect(notice).toHaveTextContent(/Location ID/i);
  });

  it.each([
    ["lookup_failed", /couldn't read your Square locations/i],
    ["none", /no active location/i],
  ])("warns that orders can't be sent when location=%s", (status, message) => {
    renderWithProviders(<SquareCallbackPage />, {
      initialEntries: [`${CALLBACK}?status=connected&merchant_id=ABC123&location=${status}`],
    });

    expect(screen.getByRole("alert")).toHaveTextContent(message);
  });

  it("maps reason=invalid_state to the expired/invalid message", () => {
    renderWithProviders(<SquareCallbackPage />, {
      initialEntries: [`${CALLBACK}?status=error&reason=invalid_state`],
    });

    expect(screen.getByText(/Square connection failed/i)).toBeInTheDocument();
    expect(
      screen.getByText(/expired or is invalid/i)
    ).toBeInTheDocument();
  });
});
