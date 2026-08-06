import createDOMPurify, { type Config } from "dompurify";

type RichHtmlProps = {
  html: string;
  className?: string;
};

const purifier = createDOMPurify(window);

const sanitizerConfig: Config = {
  ADD_ATTR: ["alttext"],
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

const sanitizeRichHtml = (html: string): string =>
  purifier.sanitize(html, sanitizerConfig);

export function htmlToPlainText(html: string): string {
  const fragment = purifier.sanitize(html, {
    ...sanitizerConfig,
    RETURN_DOM_FRAGMENT: true,
  });

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
