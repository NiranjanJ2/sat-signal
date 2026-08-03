import "@testing-library/jest-dom/vitest";

// Node 26 exposes an experimental global localStorage accessor. Vitest sees the
// name before jsdom initializes and leaves the Node value in place, so install
// the same Storage-shaped test double jsdom would otherwise provide. Defining
// it directly avoids reading the warning-producing Node accessor.
const values = new Map<string, string>();
const storage: Storage = {
  get length() {
    return values.size;
  },
  clear() {
    values.clear();
  },
  getItem(key) {
    return values.get(key) ?? null;
  },
  key(index) {
    return Array.from(values.keys())[index] ?? null;
  },
  removeItem(key) {
    values.delete(key);
  },
  setItem(key, value) {
    values.set(key, String(value));
  },
};

Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: storage,
});
