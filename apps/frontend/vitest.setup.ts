import "@testing-library/jest-dom/vitest";

// jsdom does not implement URL.createObjectURL
Object.defineProperty(URL, "createObjectURL", {
  value: () => "blob:http://localhost/fake-object-url",
  writable: true,
});

// jsdom does not implement URL.revokeObjectURL
Object.defineProperty(URL, "revokeObjectURL", {
  value: () => {},
  writable: true,
});
