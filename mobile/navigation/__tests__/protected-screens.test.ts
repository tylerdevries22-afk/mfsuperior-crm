import { readdirSync } from "node:fs";
import { resolve } from "node:path";

import { protectedScreens } from "../protected-screens";

it("registers every operational route under the authenticated guard", () => {
  const appRoot = resolve(__dirname, "../../app");
  const routes = readdirSync(appRoot, { recursive: true, encoding: "utf8" })
    .filter((path) => path.endsWith(".tsx") && !path.startsWith("(") && !path.endsWith("_layout.tsx"))
    .map((path) => path.replace(/\.tsx$/, ""))
    .filter((path) => path !== "pending-approval");
  const registered = protectedScreens.map((screen) => screen.name);
  expect(new Set(registered).size).toBe(registered.length);
  expect([...registered].filter((name) => name !== "(tabs)").sort()).toEqual(routes.sort());
});
