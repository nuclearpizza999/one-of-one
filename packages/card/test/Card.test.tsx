import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Card, startsInCaption } from "../src/Card";

const caption = {
  place: "Seoul, South Korea",
  date: "July 1st, 2026",
  coords: "37.5563° N, 126.9236° E",
  number: 3 as number | null,
};
const photo = { src: "blob:photo", width: 900, height: 1200 };

describe("Card with a photo", () => {
  it("renders the photo whole at its natural dimensions", () => {
    const html = renderToStaticMarkup(<Card photo={photo} {...caption} />);
    expect(html).toContain('<img class="oo-photo" src="blob:photo" alt="" width="900" height="1200"/>');
    expect(html).toContain('data-empty="false"');
  });

  it("renders the three caption lines and the number", () => {
    const html = renderToStaticMarkup(<Card photo={photo} {...caption} />);
    expect(html).toContain('<span class="oo-line oo-line-place">Seoul, South Korea</span>');
    expect(html).toContain('<span class="oo-line oo-line-date">July 1st, 2026</span>');
    expect(html).toContain('<span class="oo-line oo-line-coords">37.5563° N, 126.9236° E</span>');
    expect(html).toContain('<span class="oo-num">#3</span>');
  });

  it("omits empty lines and leaves the number slot empty when null", () => {
    const html = renderToStaticMarkup(<Card photo={photo} {...caption} coords="" number={null} />);
    expect(html).not.toContain("oo-line-coords");
    expect(html).toContain('<span class="oo-num"></span>');
  });

  it("keeps empty lines with hints when editable", () => {
    const html = renderToStaticMarkup(<Card photo={photo} {...caption} place="" coords="" editable />);
    expect(html).toContain('data-editable="true"');
    expect(html).toContain('data-hint="Where was this?"');
    expect(html).toContain('data-hint="Coordinates"');
    // React 19's server renderer writes booleanish attributes in camelCase; HTML attribute names are case-insensitive.
    expect(html.toLowerCase()).toContain('contenteditable="plaintext-only"');
  });

  it("escapes caption text in editable lines", () => {
    const html = renderToStaticMarkup(<Card photo={photo} {...caption} place="<b>&" editable />);
    expect(html).toContain("&lt;b&gt;&amp;");
    expect(html).not.toContain("<b>");
  });

  it("applies the intro class on the frame and the wall on the card", () => {
    const html = renderToStaticMarkup(<Card photo={photo} {...caption} intro="flip" wall="dark" id="c" />);
    expect(html).toContain('<div class="oo-frame oo-intro-flip" id="c">');
    expect(html).toContain('data-wall="dark"');
  });

  it("defaults to the light wall and no intro", () => {
    const html = renderToStaticMarkup(<Card photo={photo} {...caption} />);
    expect(html).toContain('<div class="oo-frame">');
    expect(html).toContain('data-wall="light"');
  });

  it("renders the border slot inside the card", () => {
    const html = renderToStaticMarkup(
      <Card photo={photo} {...caption} border={<i data-texture="grain" />} />,
    );
    expect(html).toContain('<div class="oo-border"><i data-texture="grain"></i></div>');
  });
});

describe("Card empty state", () => {
  it("is a button labelled Add a photo", () => {
    const html = renderToStaticMarkup(<Card photo={null} place="" date="" coords="" number={null} onPick={() => {}} />);
    expect(html).toContain('data-empty="true"');
    expect(html).toContain('role="button"');
    expect(html).toContain('aria-label="Add a photo"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('<div class="oo-empty">Tap to add a photo</div>');
    expect(html).not.toContain('class="oo-photo"');
  });

  it("is not a button without onPick", () => {
    const html = renderToStaticMarkup(<Card photo={null} place="" date="" coords="" number={null} />);
    expect(html).not.toContain('role="button"');
  });
});

describe("startsInCaption", () => {
  it("returns true for a target inside a contenteditable element", () => {
    const target = { closest: (sel: string) => (sel === "[contenteditable]" ? {} : null) };
    expect(startsInCaption(target as unknown as EventTarget)).toBe(true);
  });

  it("returns false for a target outside any contenteditable element", () => {
    const target = { closest: () => null };
    expect(startsInCaption(target as unknown as EventTarget)).toBe(false);
  });

  it("returns false for null and for a target without closest", () => {
    expect(startsInCaption(null)).toBe(false);
    expect(startsInCaption({} as unknown as EventTarget)).toBe(false);
  });
});
