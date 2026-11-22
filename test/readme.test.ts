import { expect, test } from "vitest";
import compose from "../docker-compose.yml?raw";
import readme from "../README.md?raw";

test("the compose file shown in the README is exactly docker-compose.yml", () => {
  expect(readme).toContain("```yaml\n" + compose.trimEnd() + "\n```");
});
