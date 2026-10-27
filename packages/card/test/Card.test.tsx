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
const variation = {
  texture: "grain",
  tone: "warm",
  palette: { tint: "#b08860", foil: ["#f3d9a4", "#b8864a"] },
  tier: "fine",
  motion: "none",
  intro: "rise",
  seed: 7,
} as const;

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
    expect(html).toContain('class="oo-frame oo-intro-flip"');
    expect(html).toContain('id="c"');
    expect(html).toContain('data-wall="dark"');
  });

  it("defaults to the light wall and no intro", () => {
    const html = renderToStaticMarkup(<Card photo={photo} {...caption} />);
    expect(html).toContain('class="oo-frame"');
    expect(html).toContain("--oo-mat:5cqw");
    expect(html).toContain('data-wall="light"');
  });

  it("draws the border image under the photo when a variation is given", () => {
    const html = renderToStaticMarkup(<Card photo={photo} {...caption} variation={variation} />);
    expect(html).toContain('<div class="oo-border"><img class="oo-border-img" src="data:image/svg+xml;charset=utf-8,');
    expect(html.indexOf('class="oo-border"')).toBeLessThan(html.indexOf('class="oo-photo-wrap"'));
    expect(html).toContain('data-texture="grain"');
    expect(html).toContain('data-tone="warm"');
    expect(html).toContain('data-tier="fine"');
    expect(html).toContain('data-motion="none"');
    expect(html).not.toContain("--oo-band");
  });

  it("omits the border without a variation", () => {
    const html = renderToStaticMarkup(<Card photo={photo} {...caption} />);
    expect(html).not.toContain("oo-border");
    expect(html).not.toContain("data-texture");
  });

  it("adds the motion class on the frame for a sheen", () => {
    const sheen = { ...variation, motion: "sheen" } as const;
    expect(renderToStaticMarkup(<Card photo={photo} {...caption} variation={sheen} />)).toContain('class="oo-frame oo-motion-sheen"');
    expect(renderToStaticMarkup(<Card photo={photo} {...caption} variation={sheen} intro="flip" />)).toContain('class="oo-frame oo-intro-flip oo-motion-sheen"');
  });

  it("adds the founders' intro classes on the frame", () => {
    const sheen = { ...variation, motion: "sheen" } as const;
    for (const intro of ["fade", "slide", "drop"] as const) {
      expect(renderToStaticMarkup(<Card photo={photo} {...caption} variation={sheen} intro={intro} />)).toContain(
        `class="oo-frame oo-intro-${intro} oo-motion-sheen"`,
      );
    }
  });
});

describe("Card empty state", () => {
  it("draws no border on the empty mat even with a variation", () => {
    const html = renderToStaticMarkup(<Card photo={null} place="" date="" coords="" number={null} variation={variation} />);
    expect(html).not.toContain("oo-border");
  });

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
