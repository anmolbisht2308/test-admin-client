import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QuestionRenderer } from "../src/question-renderer";

describe("QuestionRenderer", () => {
  it("shows a placeholder first, then the rendered content", async () => {
    const { container } = render(<QuestionRenderer content="What is $2+2$? **Choose one**" />);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    await waitFor(() => expect(screen.getByText("Choose one").tagName).toBe("STRONG"));
    expect(container.querySelector(".katex")).not.toBeNull();
  });
});
