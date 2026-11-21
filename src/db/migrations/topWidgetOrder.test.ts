// The migration talks to the real in-memory database. Stub the extension
// storage globals before importing it, since Jest runs in plain Node.
(globalThis as any).BUILD_TARGET = "firefox";
(globalThis as any).DEV = false;
(globalThis as any).window = {
  addEventListener: () => {},
  removeEventListener: () => {},
};
(globalThis as any).browser = {
  storage: {
    sync: { get: async () => ({}), set: async () => {}, remove: async () => {} },
    local: { get: async () => ({}), set: async () => {}, remove: async () => {} },
  },
};

// `require` is typed through an eval so the test tsconfig needs no Node types.
const req = eval("require") as (path: string) => any;
const { DB } = req("../../lib");
const { db } = req("../state");
const { reorderTopWidgets } = req("./topWidgetOrder");

const OLD: Record<string, number> = {
  "default-time": 0,
  "default-search": 1,
  "default-links": 2,
  "default-greeting": 3,
};

const NEW: Record<string, number> = {
  "default-time": 0,
  "default-greeting": 1,
  "default-search": 2,
  "default-links": 3,
};

const seed = (orders: Record<string, number>) => {
  for (const [key] of DB.prefix(db, "")) DB.del(db, key);
  for (const [id, order] of Object.entries(orders))
    DB.put(db, `widget/${id}`, {
      id,
      key: `widget/${id.split("-")[1]}`,
      order,
      display: { position: "topCentre" },
    });
};

describe("reorderTopWidgets", () => {
  it("swaps greeting and search only on the untouched old default", () => {
    seed(OLD);
    reorderTopWidgets();

    for (const [id, order] of Object.entries(NEW))
      expect(DB.get(db, `widget/${id}`)?.order).toBe(order);
  });

  it("leaves a user-chosen order alone", () => {
    seed({ ...OLD, "default-search": 9 });
    reorderTopWidgets();

    expect(DB.get(db, "widget/default-search")?.order).toBe(9);
  });

  it("does not run twice after a later manual change", () => {
    seed(OLD);
    reorderTopWidgets();
    DB.put(db, "widget/default-greeting", {
      ...DB.get(db, "widget/default-greeting"),
      order: 7,
    });
    reorderTopWidgets();

    expect(DB.get(db, "widget/default-greeting")?.order).toBe(7);
  });
});
