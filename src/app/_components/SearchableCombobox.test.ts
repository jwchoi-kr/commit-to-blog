import { describe, expect, it } from "vitest";

import { filterByText } from "./SearchableCombobox";

type Item = { name: string };
const items: Item[] = [{ name: "alpha" }, { name: "BETA" }, { name: "gamma-delta" }];

describe("filterByText", () => {
  it("빈 쿼리는 입력을 그대로 반환한다", () => {
    expect(filterByText(items, "", (i) => i.name)).toEqual(items);
    expect(filterByText(items, "   ", (i) => i.name)).toEqual(items);
  });

  it("대소문자 무시 부분일치", () => {
    expect(filterByText(items, "Beta", (i) => i.name)).toEqual([{ name: "BETA" }]);
    expect(filterByText(items, "ELT", (i) => i.name)).toEqual([{ name: "gamma-delta" }]);
  });

  it("매치 없으면 빈 배열", () => {
    expect(filterByText(items, "zzz", (i) => i.name)).toEqual([]);
  });
});
