import createDOMPurify, { type Config } from "dompurify";

type RichHtmlProps = {
  html: string;
  className?: string;
};

const purifier = createDOMPurify(window);

const sanitizerConfig: Config = {
  ADD_ATTR: ["alttext", "close", "open", "separators"],
  ADD_TAGS: ["mfenced", "use"],
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
const svgNamespace = "http://www.w3.org/2000/svg";
const svgPresentationAttributes = new WeakMap<Element, Map<string, string>>();

const svgPaintPattern =
  /^(?:none|#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8}))$/iu;
const svgNumberPattern = /^(?:\d+(?:\.\d+)?|\.\d+)$/u;
const svgPresentationValidators: Readonly<Record<string, RegExp>> = {
  fill: svgPaintPattern,
  stroke: svgPaintPattern,
  "stroke-linecap": /^(?:butt|round|square)$/u,
  "stroke-linejoin": /^(?:bevel|miter|round)$/u,
  "stroke-width": svgNumberPattern,
};

const extractSafeSvgPresentationAttributes = (
  style: string,
): Map<string, string> => {
  const effectiveDeclarations = new Map<string, string>();

  for (const declaration of style.split(";")) {
    const separator = declaration.indexOf(":");
    if (separator < 0) {
      continue;
    }

    effectiveDeclarations.set(
      declaration.slice(0, separator).trim().toLowerCase(),
      declaration.slice(separator + 1).trim().toLowerCase(),
    );
  }

  const safeAttributes = new Map<string, string>();
  for (const [name, value] of effectiveDeclarations) {
    if (svgPresentationValidators[name]?.test(value)) {
      safeAttributes.set(name, value);
    }
  }

  return safeAttributes;
};

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
  const attributeName = attribute.attrName.toLowerCase();

  if (attributeName === "style" && _node.namespaceURI === svgNamespace) {
    svgPresentationAttributes.set(
      _node as Element,
      extractSafeSvgPresentationAttributes(attribute.attrValue),
    );
  }

  if (
    _node.namespaceURI === svgNamespace &&
    _node.nodeName.toLowerCase() === "use" &&
    (attributeName === "href" || attributeName === "xlink:href") &&
    !/^#[^#\s\u0000-\u001f\u007f]+$/u.test(attribute.attrValue.trim())
  ) {
    attribute.keepAttr = false;
  }

  if (
    urlAttributes.has(attributeName) &&
    isUnsafeUrl(attribute.attrValue)
  ) {
    attribute.keepAttr = false;
  }
});

purifier.addHook("afterSanitizeAttributes", (node) => {
  const presentationAttributes = svgPresentationAttributes.get(node as Element);
  svgPresentationAttributes.delete(node as Element);

  for (const [name, value] of presentationAttributes ?? []) {
    (node as Element).setAttribute(name, value);
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
