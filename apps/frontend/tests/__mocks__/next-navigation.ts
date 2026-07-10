import { vi } from "vitest";

export const mockPush = vi.fn();
export const mockReplace = vi.fn();

export const useRouter = vi.fn(() => ({
  push: mockPush,
  replace: mockReplace,
  back: vi.fn(),
  prefetch: vi.fn(),
}));

export const usePathname = vi.fn(() => "/");
export const useSearchParams = vi.fn(() => new URLSearchParams());
