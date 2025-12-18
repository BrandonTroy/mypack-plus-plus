import { useEffect, useRef, useState } from "preact/hooks";
import { GlobalMutationObserver, globalQuerySelectorAll } from "../utils/iframe";

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
          { selector: '#addToCartPanel li[role="tab"] a' }
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
    // Initialize from sessionStorage
    const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  });

  // Sync to sessionStorage whenever state changes
  useEffect(() => {
    sessionStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify(navigationStack),
    );
  }, [navigationStack]);

  // Ref to track the elements that already have listeners attached
  const trackedElements = useRef<Set<string>>(new Set());

  // Detect elements in the DOM and attach click listeners
  useEffect(() => {
    let stackIndex = 0;

    // Recursively traverse navigation elements and attach listeners
    const detectElements = async (elements: NavElement[], level: number) => {
      for (const element of elements) {
        if (globalQuerySelectorAll(element.selector).length > 0) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          const elems = globalQuerySelectorAll<HTMLElement>(element.selector);

          // restore navigation if not restored before
          const current = navigationStack[stackIndex];
          if (current?.selector === element.selector) {
            if (stackIndex === 0)
              await chrome.runtime.sendMessage({ type: "RESET_LOADER" });
            elems[current.index]?.click();
            stackIndex++;
          }

          // attach listeners only if not attached before
          if (!trackedElements.current.has(element.selector)) {
            trackedElements.current.add(element.selector);
            elems.forEach((elem, index) => {
              elem.addEventListener("click", () => {
                setNavigationStack((prev) => [
                  ...prev.slice(0, level),
                  { selector: element.selector, index },
                ]);
              });
            });
          }

          // check children if the parent exists
          if (element.children) {
            await detectElements(element.children, level + 1);
          }
        }
      }
    };

    // Observe mutations globally to detect navigation elements dynamically
    const handleMutation = () => detectElements(ELEMENTS, 0);
    const observer = new GlobalMutationObserver(handleMutation);
    observer.observe(document.body, { childList: true, subtree: true });
    handleMutation();

    return () => observer.disconnect();
  }, []);

  return null;
}
