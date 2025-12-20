import { useEffect, useRef, useState } from "preact/hooks";
import {
  GlobalMutationObserver,
  getGlobalSelector,
  getTargetElement,
  globalQuerySelector,
  globalQuerySelectorAll,
} from "../utils/iframe";

type NavElement = { selector: string; children?: NavElement[] };
type NavEntry = { selector: string; index: number };

const SESSION_STORAGE_KEY = "mppp-navigation";

const ELEMENTS: NavElement[] = [
  // Core navbar buttons
  {
    selector: 'div[role="navigation"] li[role="button"]',
    children: [
      // Enrollment wizard tabs
      {
        selector: "#tabs-list a",
        children: [
          // Add to cart tabs
          {
            selector: '#addToCartPanel li[role="tab"] a',
            children: [
              // Planner courses show sections links
              { selector: ".showClassSectionsLink" },
            ],
          },
        ],
      },
    ],
  },
];

/**
 * Handles navigation by detecting button clicks and restoring state on load
 */
export default function NavigationHandler() {
  const [navigationStack, setNavigationStack] = useState<NavEntry[]>(() => {
    const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
    return stored ? (JSON.parse(stored).navigationStack ?? []) : [];
  });

  const [scrollPositions, setScrollPositions] = useState<
    Record<string, number>
  >(() => {
    const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
    return stored ? (JSON.parse(stored).scrollPositions ?? {}) : {};
  });

  // Sync to sessionStorage whenever state changes
  useEffect(() => {
    sessionStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({ navigationStack, scrollPositions }),
    );
  }, [navigationStack, scrollPositions]);

  // Ref to track the elements that already have listeners attached
  const trackedElements = useRef<Set<string>>(new Set());

  // Detect elements in the DOM and attach event handlers
  useEffect(() => {
    let stackIndex = 0;

    // Recursively traverse navigation elements and attach listeners
    const detectElements = async (elements: NavElement[], path: NavElement[] = []) => {
      for (const element of elements) {
        if (globalQuerySelectorAll(element.selector).length > 0) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          const elems = globalQuerySelectorAll<HTMLElement>(element.selector);

          // Restore navigation if not restored before
          const current = navigationStack[stackIndex];
          if (current?.selector === element.selector) {
            if (stackIndex === 0)
              await chrome.runtime.sendMessage({ type: "RESET_LOADER" });
            elems[current.index]?.click();
            stackIndex++;

            // Restore scroll positions after navigation is fully restored
            if (stackIndex === navigationStack.length) {
              restoreScrollPositions();
            }
          }

          // Attach listeners only if not attached before
          if (!trackedElements.current.has(element.selector)) {
            trackedElements.current.add(element.selector);
            elems.forEach((elem, index) => {
              elem.addEventListener("click", () => {
                setNavigationStack((prev) => {
                  const newStack = prev.slice(0, path.length);
                  // Fill missing levels from path
                  for (let i = newStack.length; i < path.length; i++) {
                    newStack.push({ selector: path[i].selector, index: 0 });
                  }
                  newStack.push({ selector: element.selector, index });
                  return newStack;
                });
              });
            });
          }

          // Check children if the parent exists
          if (element.children) {
            await detectElements(element.children, [...path, element]);
          }
        }
      }
    };

    // Restore scroll positions for tracked elements, untracking those that can't be
    const restoreScrollPositions = () => {
      for (const [selector, scrollTop] of Object.entries(scrollPositions)) {
        function restore() {
          const element = globalQuerySelector<HTMLElement>(selector, false);

          if (
            element &&
            element.scrollHeight - element.clientHeight >= scrollTop
          ) {
            element.scrollTo({ top: scrollTop, behavior: "smooth" });
            observer.disconnect();
            clearTimeout(timeout);
          }
        }

        // Observe for changes to restore height when possible
        const observer = new GlobalMutationObserver(restore);
        observer.observe(document.body, { childList: true, subtree: true });

        // After a timeout, give up and remove the element from the map
        const timeout = setTimeout(() => {
          setScrollPositions((prev) => {
            const updated = { ...prev };
            delete updated[selector];
            return updated;
          });

          observer.disconnect();
        }, 10000);

        restore();
      }
    };

    // Observe mutations globally to detect navigation elements dynamically
    const handleMutation = () => detectElements(ELEMENTS);

    const observer = new GlobalMutationObserver(handleMutation, {
      onDocumentDiscovered: (doc) => {
        // Attach scrollend listener to each document as it's discovered
        doc.addEventListener(
          "scrollend",
          (e) => {
            const target = getTargetElement(e.target);

            if (target && target.scrollHeight > target.clientHeight) {
              const selector = getGlobalSelector(target);
              setScrollPositions((prev) => ({
                ...prev,
                [selector]: target.scrollTop,
              }));
            }
          },
          true,
        );
      },
    });
    observer.observe(document.body, { childList: true, subtree: true });
    handleMutation();

    return () => observer.disconnect();
  }, []);

  return null;
}
