import { isTraversal, parse, stringify, type TagSelector } from "css-what";

/**
 * A MutationObserver that observes both the main document and any child iframes
 */
export class GlobalMutationObserver {
  private observers: MutationObserver[] = [];
  private observedDocs = new Set<Document>();
  private callback: MutationCallback;
  private options: MutationObserverInit;
  private onDocumentDiscovered?: (doc: Document) => void;

  constructor(
    callback: MutationCallback,
    options?: MutationObserverInit & {
      onDocumentDiscovered?: (doc: Document) => void;
    },
  ) {
    this.callback = callback;
    const { onDocumentDiscovered, ...mutationOptions } = options ?? {};
    this.options = { childList: true, subtree: true, ...mutationOptions };
    this.onDocumentDiscovered = onDocumentDiscovered;
  }

  /**
   * Start observing the target element and any iframes within it
   */
  observe(target: Node, options?: MutationObserverInit): void {
    if (options) {
      this.options = options;
    }

    const doc = target.ownerDocument || (target as Document);

    if (!this.observedDocs.has(doc)) {
      this.observedDocs.add(doc);

      // Notify about the discovered document
      this.onDocumentDiscovered?.(doc);

      const observer = new MutationObserver(this.callback);
      observer.observe(target, this.options);
      this.observers.push(observer);

      // Set up mutation handler to detect new iframes
      const handleMutation = () => this.observeIframes(doc);

      const iframeDetector = new MutationObserver(handleMutation);
      iframeDetector.observe(target, { childList: true, subtree: true });
      this.observers.push(iframeDetector);

      // Initial check for existing iframes
      this.observeIframes(doc);
    }
  }

  /**
   * Observe any iframes in the document
   */
  private observeIframes(doc: Document): void {
    const iframes = doc.querySelectorAll("iframe");

    iframes.forEach((iframe) => {
      const iframeDoc = iframe.contentDocument;

      if (iframeDoc?.body && !this.observedDocs.has(iframeDoc)) {
        this.observedDocs.add(iframeDoc);

        // Notify about the discovered iframe document
        this.onDocumentDiscovered?.(iframeDoc);

        const iframeObserver = new MutationObserver(this.callback);
        iframeObserver.observe(iframeDoc.body, this.options);
        this.observers.push(iframeObserver);

        // Recursively check for nested iframes
        this.observeIframes(iframeDoc);
      }
    });
  }

  /**
   * Stop observing all documents and iframes
   */
  disconnect(): void {
    this.observers.forEach((observer) => {
      observer.disconnect();
    });
    this.observers = [];
    this.observedDocs.clear();
  }

  /**
   * Get buffered mutation records from all observers
   */
  takeRecords(): MutationRecord[] {
    return this.observers.flatMap((observer) => observer.takeRecords());
  }
}

/**
 * Query selector that searches both the main document and any child iframes
 * @param selector The CSS selector to query
 * @param searchAllDocuments If true (default), returns the first match found in main
 * document or any iframe. If false, iframe tags can be included in the selector
 * and the search will be limited to valid document contexts only. For example,
 * "iframe iframe div" will search for a div inside of any iframes that are themselves
 * inside of an iframe.
 */
export function globalQuerySelector<E extends Element = Element>(
  selector: string,
  searchAllDocuments: boolean = true,
): E | null {
  return globalQuerySelectorInternal<E>(
    document,
    selector,
    searchAllDocuments,
    false,
  ) as E | null;
}

/**
 * Query selector that all searches both the main document and any child iframes
 * @param selector The CSS selector to query
 * @param searchAllDocuments If true (default), returns all matches found in main
 * document or any iframe. If false, iframe tags can be included in the selector
 * and the search will be limited to valid document contexts only. For example,
 * "iframe iframe div" will search for divs inside of any iframes that are themselves
 * inside of an iframe.
 */
export function globalQuerySelectorAll<E extends Element = Element>(
  selector: string,
  searchAllDocuments: boolean = true,
): E[] {
  return globalQuerySelectorInternal<E>(
    document,
    selector,
    searchAllDocuments,
    true,
  ) as E[];
}

function globalQuerySelectorInternal<E extends Element = Element>(
  document: Document,
  selector: string,
  searchAllDocuments: boolean,
  all: boolean,
): (E | null) | E[] {
  const allResult: E[] = [];

  // Search all documents via DFS
  if (searchAllDocuments) {
    const documents: Document[] = [document];

    while (documents.length > 0) {
      const doc = documents.pop() as Document;
      // Query the document using the internal method to handle iframes in selector
      if (all) {
        allResult.push(
          ...(globalQuerySelectorInternal<E>(
            doc,
            selector,
            false,
            true,
          ) as E[]),
        );
      } else {
        const match = globalQuerySelectorInternal<E>(
          doc,
          selector,
          false,
          false,
        ) as E | null;
        if (match) return match;
      }

      documents.push(
        ...Array.from(doc.querySelectorAll("iframe"))
          .map((iframe) => iframe.contentDocument)
          .filter((iframeDoc) => iframeDoc !== null),
      );
    }
    return all ? allResult : null;
  }

  // Parse selector into segments for iframe-aware querying
  const ast = parse(selector);
  for (const segment of ast) {
    let segmentDocuments = [document];
    let lastTagIsIframe = false;
    let start = 0;

    for (let i = 0; i < segment.length - 1; i++) {
      if (
        segment[i].type === "tag" &&
        (segment[i] as TagSelector).name === "iframe"
      ) {
        lastTagIsIframe = true;
      }

      if (
        lastTagIsIframe &&
        ["child", "descendant"].includes(segment[i].type)
      ) {
        const iframeSelector = stringify([segment.slice(start, i)]);
        start = i + 1;

        // Update segmentDocuments with the next level of valid iframe documents
        segmentDocuments = segmentDocuments.flatMap((doc) =>
          Array.from(doc.querySelectorAll<HTMLIFrameElement>(iframeSelector))
            .map((iframe) => iframe.contentDocument)
            .filter((iframeDoc) => iframeDoc !== null),
        );
      }

      if (isTraversal(segment[i])) {
        lastTagIsIframe = false;
      }
    }

    // Query the remaining selector segment within the valid documents
    const selector = stringify([segment.slice(start)]);

    for (const doc of segmentDocuments) {
      if (all) {
        allResult.push(...doc.querySelectorAll<E>(selector));
      } else {
        const match = doc.querySelector<E>(selector);
        if (match) return match;
      }
    }
  }

  return all ? allResult : null;
}

/**
 * Generate a unique selector for an element that works with globalQuerySelector.
 * Uses structural path with tag names and nth-of-type for stability across loads.
 */
export function getGlobalSelector(element: Element): string {
  // Build a minimal path upwards until we have a unique selector
  const path: string[] = [];
  let current: Element = element;
  const doc = element.ownerDocument;

  do {
    let selector = current.tagName.toLowerCase();

    // Add nth-of-type if there are siblings with the same tag
    const parent = current.parentElement as Element;
    const siblings = Array.from(parent?.children ?? []).filter(
      (el) => el.tagName === current.tagName,
    );

    if (siblings.length > 1) {
      const index = siblings.indexOf(current) + 1;
      selector += `:nth-of-type(${index})`;
    }

    path.unshift(selector);
    current = parent;
  } while (doc.querySelector(path.join(" > ")) !== element);

  // If element is inside an iframe, prepend the iframe's selector
  const iframe = doc.defaultView?.frameElement;
  const prefix = iframe ? `${getGlobalSelector(iframe)} ` : "";
  return prefix + path.join(" > ");
}

/**
 * Type guard to check if a node is a Document
 */
function isDocument(node: object | null): node is Document {
  if (node && "nodeType" in node) {
    return node.nodeType === Node.DOCUMENT_NODE;
  }
  return false;
}

/**
 * Get the target element from an event target, handling elements and documents across iframes
 */
export function getTargetElement(target: EventTarget | null): Element | null {
  return isDocument(target)
    ? target.documentElement
    : (target as Element | null);
}
