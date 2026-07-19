import { vi } from "vitest";
import "@testing-library/jest-dom/vitest";

// Next.js app-router client components (e.g. AutoRefresh) call useRouter at
// render time. The jsdom test environment has no router context, so we stub
// next/navigation here for the whole suite.
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
}));
