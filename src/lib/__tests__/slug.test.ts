import { describe, it, expect } from "vitest";
import { generateTrackSlug } from "../slug";

describe("generateTrackSlug", () => {
  it("populates slug from shorthand when shorthand is provided", () => {
    expect(generateTrackSlug("Coastal Plains Raceway", "CPR")).toBe("cpr");
    expect(generateTrackSlug("Dixie Mud Bog", "dmb_2026")).toBe("dmb_2026");
  });

  it("populates slug from track name when shorthand is omitted or empty", () => {
    expect(generateTrackSlug("Coastal Plains Raceway")).toBe("coastal-plains-raceway");
    expect(generateTrackSlug("Coastal Plains Raceway", "")).toBe("coastal-plains-raceway");
    expect(generateTrackSlug("Coastal Plains Raceway", "   ")).toBe("coastal-plains-raceway");
  });

  it("handles %20 and special characters properly without encoding bugs", () => {
    expect(generateTrackSlug("Silver%20Dollar%20Motorsports")).toBe("silver-dollar-motorsports");
    expect(generateTrackSlug("Track #1 (East & West)")).toBe("track-1-east-west");
  });
});
