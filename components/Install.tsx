"use client";

import { useState } from "react";

interface Props {
  readonly options: ReadonlyArray<{
    readonly label: string;
    readonly command: string;
  }>;
}

/** The install line, with a choice of how to add the package and a copy button. */
export function Install({ options }: Props) {
  const [selected, setSelected] = useState(0);
  const [copied, setCopied] = useState(false);
  const current = options[selected];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(current.command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be refused; the command stays selectable.
    }
  };

  return (
    <div className="border border-rule-strong bg-raised">
      <div
        role="tablist"
        aria-label="How to add Stoic"
        className="flex border-b border-rule font-mono text-xs"
      >
        {options.map((option, index) => (
          <button
            key={option.label}
            role="tab"
            type="button"
            aria-selected={index === selected}
            onClick={() => {
              setSelected(index);
              setCopied(false);
            }}
            className={`px-3 py-2 ${
              index === selected
                ? "text-print shadow-[inset_0_-2px_0_var(--color-accent)]"
                : "text-dim hover:text-print"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 py-2.5 pr-2.5 pl-3">
        <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-[12.5px] text-print">
          {current.command}
        </code>
        <button
          type="button"
          onClick={copy}
          className="border border-rule px-2.5 py-1.5 font-mono text-[11.5px] text-dim hover:border-rule-strong hover:text-print"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
