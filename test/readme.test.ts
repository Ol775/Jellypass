import { expect, test } from "vitest";
import compose from "../docker-compose.yml?raw";
import readme from "../README.md?raw";

test("the compose file shown in the README is exactly docker-compose.yml", () => {
  expect(readme).toContain("```yaml\n" + compose.trimEnd() + "\n```");
});

import roadmap from "../ROADMAP.md?raw";
test("the README's Up next list matches the Up next table in ROADMAP.md", () => {
  const up = roadmap.slice(roadmap.indexOf("## 🗓️ Up next"), roadmap.indexOf("## 💡 Later"));
  const titles = [...up.matchAll(/^\| \d+ \| \*\*(.+?)\*\* \|/gm)].map((m) => m[1]);
  expect(titles.length).toBeGreaterThan(0);
  for (const t of titles) expect(readme).toContain(`- ${t}\n`);
});
