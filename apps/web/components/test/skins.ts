import type { TemplateSkin } from "@mockprep/types";
import type { CSSProperties } from "react";

/**
 * Look of the test screen per template skin (the template decides; never the exam name).
 * Colours are set as CSS variables on the screen root and used by the components.
 */
export interface Skin {
  /** Top bar. */
  header: string;
  headerText: string;
  /** Save & Next. */
  primary: string;
  /** Mark for Review & Next. */
  mark: string;
  labels: { save: string; mark: string; clear: string; previous: string; submit: string };
}

const CBT_LABELS = {
  save: "Save & Next",
  mark: "Mark for Review & Next",
  clear: "Clear Response",
  previous: "Previous",
  submit: "Submit",
};

export const SKINS: Record<TemplateSkin, Skin> = {
  // Banking (IBPS / SBI) CBT: blue bar, blue Save & Next.
  ibps: {
    header: "#2b5f95",
    headerText: "#ffffff",
    primary: "#1f6fb2",
    mark: "#6b3fa0",
    labels: CBT_LABELS,
  },
  // SSC (TCS iON): dark navy bar, green Save & Next.
  ssc: {
    header: "#1c2e4a",
    headerText: "#ffffff",
    primary: "#2e8540",
    mark: "#6b3fa0",
    labels: CBT_LABELS,
  },
  // UPSC-style: neutral.
  upsc: {
    header: "#3b3b3b",
    headerText: "#ffffff",
    primary: "#1f6fb2",
    mark: "#6b3fa0",
    labels: CBT_LABELS,
  },
  // NTA (JEE Main): green SAVE & NEXT, orange marking, upper-case buttons.
  nta: {
    header: "#0d3c61",
    headerText: "#ffffff",
    primary: "#3c9a3f",
    mark: "#e07b1f",
    labels: {
      save: "SAVE & NEXT",
      mark: "MARK FOR REVIEW & NEXT",
      clear: "CLEAR",
      previous: "BACK",
      submit: "SUBMIT",
    },
  },
  generic: {
    header: "var(--primary)",
    headerText: "var(--primary-foreground)",
    primary: "var(--primary)",
    mark: "#6b3fa0",
    labels: CBT_LABELS,
  },
};

export const skinStyle = (skin: Skin) =>
  ({
    "--tx-header": skin.header,
    "--tx-header-fg": skin.headerText,
    "--tx-primary": skin.primary,
    "--tx-mark": skin.mark,
  }) as CSSProperties;
