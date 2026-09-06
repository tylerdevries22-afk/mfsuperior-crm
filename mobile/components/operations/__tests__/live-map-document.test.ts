import { runInNewContext } from "node:vm";

import { buildMapHtml } from "../live-map-document";

function mountMapDocument() {
  const events = new Map<string, () => void>();
  const status = { hidden: false, textContent: "Loading map tiles" };
  const postMessage = jest.fn();
  const setStyle = jest.fn();
  const map = {
    addControl: jest.fn(), resize: jest.fn(), fitBounds: jest.fn(), setStyle,
    on: (event: string, callback: () => void) => events.set(event, callback),
  };
  const html = buildMapHtml(0.3, 900);
  const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)?.[1];
  if (!script) throw new Error("Map initialization script is missing");
  runInNewContext(script, {
    document: { getElementById: () => status },
    window: { parent: { postMessage }, addEventListener: jest.fn(), innerHeight: 844 },
    maplibregl: { Map: jest.fn(() => map), NavigationControl: jest.fn() },
    requestAnimationFrame: (callback: () => void) => callback(),
    setTimeout, clearTimeout,
  });
  return { events, postMessage, setStyle, status };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

it("makes fleet markers ready before external map tiles finish loading", () => {
  const { postMessage } = mountMapDocument();
  expect(postMessage).toHaveBeenCalledWith({ source: "mf-fleet-map", type: "ready" }, "*");
});

it("retries slow tiles once, then keeps a useful loading message", () => {
  const { setStyle, status } = mountMapDocument();
  jest.advanceTimersByTime(30000);
  expect(setStyle).toHaveBeenCalledTimes(1);
  expect(status.textContent).toContain("Select a driver below");
  jest.advanceTimersByTime(60000);
  expect(setStyle).toHaveBeenCalledTimes(1);
});

it("clears the loading indicator and retry when the map loads", () => {
  const { events, setStyle, status } = mountMapDocument();
  events.get("load")?.();
  jest.advanceTimersByTime(60000);
  expect(status.hidden).toBe(true);
  expect(setStyle).not.toHaveBeenCalled();
});
