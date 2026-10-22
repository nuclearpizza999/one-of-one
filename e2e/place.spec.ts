import { expect, test } from "@playwright/test";

test("the Golden Gate Bridge resolves to the landmark", async ({ request }) => {
  const r = await request.get("/api/place?lat=37.8199&lng=-122.4783");
  expect(r.status()).toBe(200);
  expect(r.headers()["cache-control"]).toBe("no-store");
  const { match } = await r.json();
  expect(match).toMatchObject({ kind: "landmark", label: "Golden Gate Bridge, San Francisco", key: "landmark:Golden Gate Bridge, San Francisco" });
});

test("a street in Hongdae resolves to Seoul", async ({ request }) => {
  const r = await request.get("/api/place?lat=37.5563&lng=126.9236");
  expect(r.status()).toBe(200);
  const { match } = await r.json();
  expect(match).toMatchObject({ kind: "city", label: "Seoul, South Korea" });
});

test("the middle of the Pacific resolves to nothing", async ({ request }) => {
  const r = await request.get("/api/place?lat=0&lng=-140");
  expect(r.status()).toBe(200);
  expect(await r.json()).toEqual({ match: null });
});

for (const query of ["lat=abc&lng=0", "lat=91&lng=0", "lat=0&lng=181", "lat=0", "", "lat=&lng=0"]) {
  test(`rejects "${query}" with 400`, async ({ request }) => {
    const r = await request.get(`/api/place?${query}`);
    expect(r.status()).toBe(400);
    const body = await r.json();
    expect(typeof body.error).toBe("string");
    expect(r.headers()["cache-control"]).toBe("no-store");
  });
}
