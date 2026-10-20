// Signed-in stand-in for @clerk/clerk-react, aliased in by e2e/vite.e2e.config.ts.
// The responsive e2e suite renders the real dashboard without reaching Clerk's
// servers, so every hook reports a loaded, signed-in owner.
/* eslint-disable react-refresh/only-export-components -- module mirrors Clerk's mixed hook/component exports; never hot-reloaded. */
import type { ReactNode } from "react";

const user = {
  id: "user_e2e",
  fullName: "E2E Owner",
  firstName: "E2E",
  lastName: "Owner",
  primaryEmailAddress: { emailAddress: "owner@e2e.test" },
  emailAddresses: [{ emailAddress: "owner@e2e.test" }],
};

const getToken = async () => "e2e-token";
const signOut = async () => {};

export const ClerkProvider = ({ children }: { children: ReactNode }) => <>{children}</>;
export const useAuth = () => ({
  isLoaded: true,
  isSignedIn: true,
  userId: user.id,
  sessionId: "sess_e2e",
  getToken,
  signOut,
});
export const useUser = () => ({ isLoaded: true, isSignedIn: true, user });
export const SignedIn = ({ children }: { children: ReactNode }) => <>{children}</>;
export const SignedOut = () => null;
export const SignIn = () => <div data-testid="clerk-signin" />;
export const SignUp = () => <div data-testid="clerk-signup" />;
export const SignOutButton = ({ children }: { children?: ReactNode }) => <>{children}</>;
export const UserButton = () => (
  <button type="button" className="w-8 h-8 rounded-full bg-coral/20" aria-label="Account" />
);
