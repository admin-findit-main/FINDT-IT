import { describe, expect, it } from "vitest";
import {
  mapsDirectionsAnchorProps,
  mapsDirectionsUrl,
} from "../product-utils";

const store = {
  street_address: "123 Main St",
  city: "Falls Church",
  state: "VA",
  postal_code: "22046",
};

describe("mapsDirectionsUrl", () => {
  it("opens Apple Maps on iPhone", () => {
    expect(mapsDirectionsUrl(store, "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)")).toBe(
      "https://maps.apple.com/?daddr=123%20Main%20St%2C%20Falls%20Church%2C%20VA%2C%2022046&dirflg=d"
    );
  });

  it("opens the default maps app on Android", () => {
    expect(mapsDirectionsUrl(store, "Mozilla/5.0 (Linux; Android 14)")).toBe(
      "geo:0,0?q=123%20Main%20St%2C%20Falls%20Church%2C%20VA%2C%2022046"
    );
  });

  it("uses Google Maps in a desktop browser", () => {
    expect(mapsDirectionsUrl(store, "Mozilla/5.0 (Macintosh; Intel Mac OS X)")).toContain(
      "google.com/maps/dir"
    );
  });

  it("keeps native map links in the same window so the OS can hand off", () => {
    expect(
      mapsDirectionsAnchorProps(store, "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)").target
    ).toBeUndefined();
    expect(
      mapsDirectionsAnchorProps(store, "Mozilla/5.0 (Macintosh; Intel Mac OS X)").target
    ).toBe("_blank");
  });
});
