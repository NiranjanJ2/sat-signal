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
