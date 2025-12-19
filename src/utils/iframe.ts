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
    options?: MutationObserverInit & { onDocumentDiscovered?: (doc: Document) => void },
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
    this.observers.forEach((observer) => observer.disconnect());
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
 */
export function globalQuerySelector<E extends Element = Element>(
  selector: string
): E | null {
  // Try main document first
  const mainResult = document.querySelector<E>(selector);
  if (mainResult) {
    return mainResult;
  }

  // Try iframes
  for (const iframe of document.querySelectorAll('iframe')) {
    const iframeDoc = iframe.contentDocument;
    if (iframeDoc) {
      const iframeResult = iframeDoc.querySelector<E>(selector);
      if (iframeResult) {
        return iframeResult;
      }
    }
  }

  return null;
}

/**
 * Query selector all that searches both the main document and any child iframes
 */
export function globalQuerySelectorAll<E extends Element = Element>(
  selector: string
): E[] {
  const results: E[] = [];

  // Get from main document
  const mainResults = document.querySelectorAll<E>(selector);
  results.push(...Array.from(mainResults));

  // Get from iframes
  for (const iframe of document.querySelectorAll('iframe')) {
    const iframeDoc = iframe.contentDocument;
    if (iframeDoc) {
      const iframeResults = iframeDoc.querySelectorAll<E>(selector);
      results.push(...Array.from(iframeResults));
    }
  }

  return results;
}
