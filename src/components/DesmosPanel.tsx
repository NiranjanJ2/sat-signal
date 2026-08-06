import { useEffect, useRef, useState } from "react";

// ponytail: Desmos' public demo key. Swap for a free per-site key from
// desmos.com/api before this runs anywhere but your laptop.
const CALCULATOR_SRC =
  "https://www.desmos.com/api/v1.11/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6";

type Calculator = {
  destroy(): void;
  getState(): unknown;
  setState(state: unknown): void;
};

declare global {
  interface Window {
    Desmos?: {
      GraphingCalculator(
        element: HTMLElement,
        options?: Record<string, unknown>,
      ): Calculator;
    };
  }
}

let scriptPromise: Promise<void> | undefined;

const loadCalculatorScript = (): Promise<void> => {
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = CALCULATOR_SRC;
    script.async = true;
    script.addEventListener("load", () => resolve());
    script.addEventListener("error", () => {
      scriptPromise = undefined;
      script.remove();
      reject(new Error("Desmos did not load."));
    });
    document.head.appendChild(script);
  });
  return scriptPromise;
};

// PracticeView remounts for every question, so whether the calculator is open
// and the graph on it both live outside React to survive moving through the
// queue. PracticeView owns the open flag as state and writes it back here.
let panelOpen = false;
let savedGraph: unknown;

export const isCalculatorOpen = (): boolean => panelOpen;

export const rememberCalculatorOpen = (open: boolean): void => {
  panelOpen = open;
};

export function DesmosPanel({ onClose }: { onClose: () => void }) {
  const [failed, setFailed] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const calculatorRef = useRef<Calculator | null>(null);

  useEffect(() => {
    let active = true;
    void loadCalculatorScript()
      .then(() => {
        const host = hostRef.current;
        if (!active || !host || calculatorRef.current || !window.Desmos) {
          return;
        }
        const calculator = window.Desmos.GraphingCalculator(host, {
          expressions: true,
          keypad: true,
          settingsMenu: false,
          border: false,
        });
        if (savedGraph) {
          calculator.setState(savedGraph);
        }
        calculatorRef.current = calculator;
      })
      .catch(() => {
        if (active) {
          setFailed(true);
        }
      });

    return () => {
      active = false;
      const calculator = calculatorRef.current;
      if (calculator) {
        savedGraph = calculator.getState();
        calculator.destroy();
        calculatorRef.current = null;
      }
    };
  }, []);

  return (
    <section className="calculator-panel" aria-label="Graphing calculator">
      {failed ? (
        <p className="calculator-error" role="alert">
          Desmos did not load.{" "}
          <button className="link-button" type="button" onClick={onClose}>
            Close and retry
          </button>
        </p>
      ) : (
        <div id="desmos-host" className="calculator-host" ref={hostRef} />
      )}
    </section>
  );
}
