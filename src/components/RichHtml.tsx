import createDOMPurify, { type Config } from "dompurify";

type RichHtmlProps = {
  html: string;
  className?: string;
};

const purifier = createDOMPurify(window);

const sanitizerConfig: Config = {
  ADD_ATTR: ["alttext", "close", "open", "separators"],
  ADD_TAGS: ["mfenced"],
  FORBID_ATTR: ["style"],
  FORBID_TAGS: [
    "button",
    "datalist",
    "embed",
    "fieldset",
    "form",
    "iframe",
    "input",
    "object",
    "option",
    "optgroup",
    "select",
    "style",
    "textarea",
  ],
  USE_PROFILES: { html: true, mathMl: true, svg: true },
};

const mathMlNamespace = "http://www.w3.org/1998/Math/MathML";

const createMathOperator = (text: string): Element => {
  const operator = document.createElementNS(mathMlNamespace, "mo");
  operator.textContent = text;
  return operator;
};

const normalizeLegacyMathMl = (fragment: DocumentFragment): DocumentFragment => {
  for (const fence of fragment.querySelectorAll("mfenced")) {
    const row = document.createElementNS(mathMlNamespace, "mrow");
    const children = Array.from(fence.childNodes).filter(
      (child) => child.nodeType !== Node.TEXT_NODE || child.textContent?.trim(),
    );
    const separators = (fence.getAttribute("separators") ?? ",")
      .replace(/\s+/gu, "") || ",";

    row.append(createMathOperator(fence.getAttribute("open") ?? "("));
    children.forEach((child, index) => {
      if (index > 0) {
        row.append(
          createMathOperator(
            separators[Math.min(index - 1, separators.length - 1)],
          ),
        );
      }
      row.append(child);
    });
    row.append(createMathOperator(fence.getAttribute("close") ?? ")"));
    fence.replaceWith(row);
  }

  return fragment;
};

const urlAttributes = new Set([
  "action",
  "background",
  "cite",
  "formaction",
  "href",
  "poster",
  "src",
  "xlink:href",
]);

const isUnsafeUrl = (value: string): boolean => {
  const normalized = value.replace(/[\u0000-\u0020\u00a0]+/g, "").toLowerCase();
  return (
    normalized.startsWith("javascript:") ||
    /^data:text\/html(?:[;,]|$)/.test(normalized)
  );
};

purifier.addHook("uponSanitizeAttribute", (_node, attribute) => {
  if (
    urlAttributes.has(attribute.attrName.toLowerCase()) &&
    isUnsafeUrl(attribute.attrValue)
  ) {
    attribute.keepAttr = false;
  }
});

const sanitizeRichFragment = (html: string): DocumentFragment =>
  normalizeLegacyMathMl(
    purifier.sanitize(html, {
      ...sanitizerConfig,
      RETURN_DOM_FRAGMENT: true,
    }),
  );

const sanitizeRichHtml = (html: string): string => {
  const template = document.createElement("template");
  template.content.append(sanitizeRichFragment(html));
  return template.innerHTML;
};

export function htmlToPlainText(html: string): string {
  const fragment = sanitizeRichFragment(html);

  return (fragment.textContent ?? "").replace(/\s+/gu, " ").trim();
}

export function RichHtml({ html, className }: RichHtmlProps) {
  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(html) }}
    />
  );
}
