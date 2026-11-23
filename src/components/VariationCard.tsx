"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import type { TextVariation } from "@/lib/types";
import { useToast } from "./ToastProvider";

type Props = {
  index: number;
  variation: TextVariation;
  onChange: (id: string, text: string) => void;
};

export function VariationCard({ index, variation, onChange }: Props) {
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(variation.text);
      setCopied(true);
      showToast("Texto copiado!");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      showToast("Não foi possível copiar. Selecione o texto e copie manualmente.", "error");
    }
  }

  return (
    <article className="variation" style={{ animationDelay: `${index * 50}ms` }}>
      <div className="variation-header">
        <span className="variation-label">Variação {index + 1}</span>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={handleCopy}
          aria-label={`Copiar variação ${index + 1}`}
        >
          {copied ? (
            <Check size={16} strokeWidth={2.25} aria-hidden />
          ) : (
            <Copy size={16} strokeWidth={2} aria-hidden />
          )}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      <label className="sr-only" htmlFor={`var-${variation.id}`}>
        Texto da variação {index + 1}
      </label>
      <textarea
        id={`var-${variation.id}`}
        className="textarea"
        value={variation.text}
        onChange={(e) => onChange(variation.id, e.target.value)}
        rows={8}
      />
    </article>
  );
}
