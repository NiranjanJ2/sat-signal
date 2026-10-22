import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RichHtml, htmlToPlainText } from "./RichHtml";

describe("RichHtml", () => {
  it("renders College Board paragraph markup inside the supplied class", () => {
    const { container } = render(
      <RichHtml
        className="question-copy"
        html="<p>First paragraph.</p><p><strong>Second</strong> paragraph.</p>"
      />,
    );

    const root = container.firstElementChild;
    expect(root).toHaveClass("question-copy");
    expect(root?.querySelectorAll("p")).toHaveLength(2);
    expect(root?.querySelector("strong")).toHaveTextContent("Second");
  });

  it("preserves College Board underlines without retaining arbitrary inline styles", () => {
    const { container } = render(
      <RichHtml
        className="service-rich-text"
        html={'<p>Text 1: <span style="text-decoration: underline; position: fixed">assigning an age to the fossils is challenging</span>. <span style="text-decoration: none">Other text</span> <span style="text-decoration-line: underline">Also underlined</span> <span style="text-decoration: underline; text-decoration: none">Not underlined</span> <u>Semantic underline</u></p>'}
      />,
    );

    expect(container.querySelector(".rich-underline")).toHaveTextContent(
      "assigning an age to the fossils is challenging",
    );
    expect(container.querySelector("[style]")).toBeNull();
    expect(container.querySelectorAll(".rich-underline")).toHaveLength(2);
    expect(container.querySelector("u")).toHaveTextContent("Semantic underline");
  });

  it("preserves semantic table structure", () => {
    const { container } = render(
      <RichHtml
        html={
          "<table><caption>Score bands</caption><thead><tr><th scope=\"col\">Band</th></tr></thead><tbody><tr><td>700</td></tr></tbody></table>"
        }
      />,
    );

    const table = container.querySelector("table");
    expect(table?.querySelector("caption")).toHaveTextContent("Score bands");
    expect(table?.querySelector("th")).toHaveAttribute("scope", "col");
    expect(table?.querySelector("tbody td")).toHaveTextContent("700");
  });

  it("keeps legacy embedded image data without exposing it as text", () => {
    const imageData = "data:image/png;base64,iVBORw0KGgo=";
    const { container } = render(
      <RichHtml html={`<p>Graph:</p><img src="${imageData}" alt="A line graph">`} />,
    );

    const image = container.querySelector("img");
    expect(image).toHaveAttribute("src", imageData);
    expect(image).toHaveAttribute("alt", "A line graph");
    expect(container).not.toHaveTextContent("iVBORw0KGgo");
  });

  it("renders sanitized College Board inline SVG figures", () => {
    const { container } = render(
      <RichHtml
        html={
          '<figure class="image"><svg width="356.889" height="241.585" viewBox="0 0 356.889 241.585" role="img" aria-label="A geometry diagram" onload="alert(1)">' +
          '<g><line x1="17.634" y1="20.362" x2="355.944" y2="20.362" stroke="#231f20"></line>' +
          '<path d="M10 10 H 90 V 90" fill="none" stroke="#231f20"></path></g>' +
          '<script>alert(2)</script></svg></figure>'
        }
      />,
    );

    const figure = container.querySelector("figure");
    const svg = figure?.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("viewBox", "0 0 356.889 241.585");
    expect(svg).toHaveAttribute("aria-label", "A geometry diagram");
    expect(svg?.querySelector("line")).not.toBeNull();
    expect(svg?.querySelector("path")).not.toBeNull();
    expect(svg).not.toHaveAttribute("onload");
    expect(svg?.querySelector("script")).toBeNull();
  });

  it("keeps College Board SVG background paths transparent", () => {
    const { container } = render(
      <RichHtml
        html={
          '<svg viewBox="0 0 250 210"><path class="figure-background" d="M 0 200 L 245 200 L 245 0 L 0 0 Z" fill="red" style="fill:none;background-image:url(javascript:alert(1))"></path>' +
          '<path class="competing-fill" d="M 0 0 L 1 1" style="fill:none;fill:red"></path>' +
          '<polygon points="192,1 192,146 1,146" fill="none" stroke="#000"></polygon></svg>'
        }
      />,
    );

    const background = container.querySelector(".figure-background");
    expect(background).toHaveAttribute("fill", "none");
    expect(background).not.toHaveAttribute("style");
    expect(container.querySelector(".competing-fill")).not.toHaveAttribute(
      "fill",
      "none",
    );
    expect(container.querySelector(".competing-fill")).not.toHaveAttribute("style");
    expect(container.querySelector("polygon")).toHaveAttribute("stroke", "#000");
  });

  it("preserves safe College Board SVG presentation styles as attributes", () => {
    const { container } = render(
      <RichHtml
        html={
          '<svg><path class="grid-line" style="fill:none;stroke:#000000;stroke-width:0.708982"></path>' +
          '<path class="white-marker" style="fill:#ffffff;stroke:#000000;stroke-linejoin:miter"></path>' +
          '<path class="relationship" style="fill:none;stroke:#000000;stroke-linecap:square;stroke-width:2.3"></path>' +
          '<path class="unsafe-paint" style="fill:none;fill:url(javascript:alert(1));stroke:url(https://example.test/paint.svg)"></path>' +
          '<path class="invalid-color" style="fill:#12345"></path></svg>'
        }
      />,
    );

    expect(container.querySelector(".grid-line")).toHaveAttribute(
      "stroke",
      "#000000",
    );
    expect(container.querySelector(".grid-line")).toHaveAttribute(
      "stroke-width",
      "0.708982",
    );
    expect(container.querySelector(".white-marker")).toHaveAttribute(
      "fill",
      "#ffffff",
    );
    expect(container.querySelector(".white-marker")).toHaveAttribute(
      "stroke-linejoin",
      "miter",
    );
    expect(container.querySelector(".relationship")).toHaveAttribute(
      "stroke-linecap",
      "square",
    );
    expect(container.querySelector(".relationship")).toHaveAttribute(
      "stroke-width",
      "2.3",
    );
    expect(container.querySelector(".unsafe-paint")).not.toHaveAttribute("fill");
    expect(container.querySelector(".unsafe-paint")).not.toHaveAttribute("stroke");
    expect(container.querySelector(".invalid-color")).not.toHaveAttribute("fill");
    expect(container.querySelector("[style]")).toBeNull();
  });

  it("renders the graph structure used by College Board item 243f2e8b", () => {
    const { container } = render(
      <RichHtml
        html={
          '<figure><svg viewBox="0 0 507 507" role="img" aria-label="A graph in the x y-plane. Refer to the long description.">' +
          '<path class="figure-background" d="M0 507H507V0H0Z" style="fill:none"></path>' +
          '<defs><path id="axis-label" d="M0 0H4V8H0Z"></path><path id="tick-label" d="M0 0H3V6H0Z"></path><path id="point" d="M4 0A4 4 0 1 1 3.99 0Z" style="fill:#ffffff;stroke:#000000;stroke-linejoin:miter"></path></defs>' +
          '<g class="grid"><path d="M40 100H467" style="fill:none;stroke:#000000;stroke-width:0.708982"></path><path d="M250 40V467" style="fill:none;stroke:#000000;stroke-width:0.708982"></path></g>' +
          '<g class="axes"><path d="M40 250H467" style="fill:none;stroke:#000000;stroke-width:1.949699"></path><path d="M250 467V40" style="fill:none;stroke:#000000;stroke-width:1.949699"></path></g>' +
          '<g class="labels"><use href="#axis-label" x="470" y="245"></use><use href="#axis-label" x="255" y="35"></use><use href="#tick-label" x="235" y="260"></use></g>' +
          '<g class="points"><use href="#point" x="250" y="300" style="fill:#ffffff;stroke:#000000"></use><use href="#point" x="300" y="275" style="fill:#ffffff;stroke:#000000"></use><use href="#point" x="350" y="250" style="fill:#ffffff;stroke:#000000"></use></g>' +
          '<path class="relationship-line" d="M220 315L390 230" style="fill:none;stroke:#000000;stroke-linecap:square;stroke-width:2.3"></path>' +
          '<clipPath id="plot-area"><rect x="40" y="40" width="427" height="427"></rect></clipPath></svg>' +
          '<div role="region" aria-label="Long description for the graph"><p>The line passes through the points (0, negative 5), (1, negative 3), and (2, negative 1).</p></div></figure>'
        }
      />,
    );

    expect(container.querySelector(".grid path")).toHaveAttribute(
      "stroke-width",
      "0.708982",
    );
    expect(container.querySelector(".axes path")).toHaveAttribute(
      "stroke",
      "#000000",
    );
    expect(container.querySelector("#point")).toHaveAttribute("fill", "#ffffff");
    expect(container.querySelectorAll(".points use")).toHaveLength(3);
    expect(container.querySelector(".relationship-line")).toHaveAttribute(
      "stroke-width",
      "2.3",
    );
    expect(container.querySelector(".relationship-line")).toHaveAttribute(
      "stroke-linecap",
      "square",
    );
    expect(container.querySelector("#plot-area rect")).not.toBeNull();
    expect(container).toHaveTextContent("(0, negative 5)");
    expect(container.querySelector("style")).toBeNull();
    expect(container.querySelector("[style]")).toBeNull();
  });

  it("renders College Board SVG glyph references without allowing external use URLs", () => {
    const { container } = render(
      <RichHtml
        html={
          '<svg><defs><path id="53-glyph" d="M 0 0 L 4 0"></path></defs>' +
          '<use class="safe-glyph" xlink:href="#53-glyph"></use>' +
          '<use class="external-glyph" href="https://example.test/sprite.svg#glyph"></use>' +
          '<use class="external-xlink-glyph" xlink:href="https://example.test/sprite.svg#glyph"></use>' +
          '<use class="script-glyph" href="javascript:alert(1)"></use></svg>'
        }
      />,
    );

    expect(container.querySelector(".safe-glyph")).toHaveAttribute(
      "xlink:href",
      "#53-glyph",
    );
    expect(container.querySelector(".external-glyph")).not.toHaveAttribute("href");
    expect(container.querySelector(".external-xlink-glyph")).not.toHaveAttribute(
      "xlink:href",
    );
    expect(container.querySelector(".script-glyph")).not.toHaveAttribute("href");
  });

  it("renders the complete SVG structure used by College Board item 3e66c309", () => {
    const { container } = render(
      <RichHtml
        html={
          '<figure><svg viewBox="0 0 250 210" role="img" aria-label="Right triangle upper R upper S upper T. Refer to long description.">' +
          '<path class="figure-background" d="M0 200 L245 200 L245 0 L0 0Z" style="fill:none"></path>' +
          '<defs><path id="digit-5"></path><path id="digit-3"></path><path id="letter-r"></path><path id="letter-s"></path><path id="letter-t"></path><path id="note-glyph"></path></defs>' +
          '<g class="side-label"><use href="#digit-5"></use><use href="#digit-3"></use></g>' +
          '<g class="vertex-labels"><use href="#letter-r"></use><use href="#letter-s"></use><use href="#letter-t"></use></g>' +
          '<polygon class="triangle" points="192,1 192,146 1,146" fill="none" stroke="#000"></polygon>' +
          '<rect class="right-angle" x="181" y="135" width="11" height="11" fill="none" stroke="#000"></rect>' +
          '<g class="note-label"><use href="#note-glyph"></use></g></svg>' +
          '<div role="region" aria-label="Long description for right triangle upper R upper S upper T"><ul><li>Angle upper S is a right angle.</li><li>The length of side upper R upper T is 53.</li><li>A note indicates the figure is not drawn to scale.</li></ul></div></figure>'
        }
      />,
    );

    expect(container.querySelector(".figure-background")).toHaveAttribute(
      "fill",
      "none",
    );
    expect(container.querySelector(".triangle")).not.toBeNull();
    expect(container.querySelector(".right-angle")).not.toBeNull();
    expect(container.querySelectorAll(".side-label use")).toHaveLength(2);
    expect(container.querySelectorAll(".vertex-labels use")).toHaveLength(3);
    expect(container.querySelectorAll(".note-label use")).toHaveLength(1);
    expect(container).toHaveTextContent("The length of side upper R upper T is 53.");
    expect(container).toHaveTextContent("figure is not drawn to scale");
    expect(container.querySelector("style")).toBeNull();
    expect(container.querySelector("[style]")).toBeNull();
  });

  it("preserves MathML structure and accessible alt text", () => {
    const { container } = render(
      <RichHtml
        html={
          '<math alttext="x squared"><msup><mi>x</mi><mn>2</mn></msup></math>'
        }
      />,
    );

    const math = container.querySelector("math");
    expect(math?.getAttribute("alttext")).toBe("x squared");
    expect(math?.querySelector("msup")).not.toBeNull();
    expect(math?.textContent).toBe("x2");
  });

  it("renders parentheses from College Board legacy mfenced MathML", () => {
    const { container } = render(
      <RichHtml
        html={
          '<math alttext="0.17 left parenthesis x plus y right parenthesis">' +
          '<mn>0.17</mn><mfenced><mrow><mi>x</mi><mo>+</mo><mi>y</mi></mrow></mfenced></math>'
        }
      />,
    );

    const math = container.querySelector("math");
    expect(math?.textContent).toBe("0.17(x+y)");
    expect(math?.querySelector("mfenced")).toBeNull();
  });

  it("removes scripts and inline event handlers", () => {
    const { container } = render(
      <RichHtml
        html={
          '<p onclick="alert(1)">Keep me<img src="https://example.test/graph.png" onerror="alert(2)"></p><script>alert(3)</script>'
        }
      />,
    );

    expect(container).toHaveTextContent("Keep me");
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("[onclick]")).toBeNull();
    expect(container.querySelector("[onerror]")).toBeNull();
  });

  it("removes executable and HTML data URLs while keeping safe URLs", () => {
    const imageData = "data:image/png;base64,AA==";
    const { container } = render(
      <RichHtml
        html={
          `<a class="unsafe-link" href="java&#x09;script:alert(1)">unsafe</a>` +
          `<img class="html-data" alt="unsafe image" src="data:text/html;base64,PHNjcmlwdD4=">` +
          `<a class="safe-link" href="https://example.test/help">safe</a>` +
          `<img class="safe-data" alt="safe image" src="${imageData}">`
        }
      />,
    );

    expect(container.querySelector(".unsafe-link")).not.toHaveAttribute("href");
    expect(container.querySelector(".html-data")).not.toHaveAttribute("src");
    expect(container.querySelector(".safe-link")).toHaveAttribute(
      "href",
      "https://example.test/help",
    );
    expect(container.querySelector(".safe-data")).toHaveAttribute("src", imageData);
  });

  it("removes forms, embedded browsing contexts, and form controls", () => {
    const { container } = render(
      <RichHtml
        html={
          '<form action="https://example.test/collect"><label>Name<input name="name"></label><button>Send</button></form><iframe src="https://example.test/embed"></iframe>'
        }
      />,
    );

    expect(container.querySelector("form")).toBeNull();
    expect(container.querySelector("input")).toBeNull();
    expect(container.querySelector("button")).toBeNull();
    expect(container.querySelector("iframe")).toBeNull();
  });

  it("removes inline and stylesheet CSS", () => {
    const { container } = render(
      <RichHtml
        html={
          '<style>@import url("https://example.test/track.css");</style><p style="background-image:url(javascript:alert(1))">Readable</p>'
        }
      />,
    );

    expect(container.querySelector("style")).toBeNull();
    expect(container.querySelector("p")).not.toHaveAttribute("style");
    expect(container).toHaveTextContent("Readable");
  });
});

describe("htmlToPlainText", () => {
  it("returns collapsed text without markup or base64 image data", () => {
    const imageData = "data:image/png;base64,QUJDREVGRw==";

    const plainText = htmlToPlainText(
      `<p>  First <strong>term</strong> </p>` +
        `<img src="${imageData}" alt="Decorative graph">` +
        "<p>Second&nbsp;line</p>",
    );

    expect(plainText).toBe("First term Second line");
    expect(plainText).not.toContain("QUJDREVGRw");
    expect(plainText).not.toContain("<strong>");
  });

  it("does not include text from active content", () => {
    expect(
      htmlToPlainText("<p>Question text</p><script>secretPayload()</script>"),
    ).toBe("Question text");
  });
});
