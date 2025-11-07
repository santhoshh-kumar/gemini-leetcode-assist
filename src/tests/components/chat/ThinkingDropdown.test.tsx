import { render, screen, fireEvent } from "@testing-library/react";
import ThinkingDropdown from "@/components/chat/ThinkingDropdown";

describe("ThinkingDropdown", () => {
  it("renders nothing when thinking array is empty", () => {
    const { container } = render(<ThinkingDropdown thinking={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when thinking is null", () => {
    const { container } = render(<ThinkingDropdown thinking={null as unknown as string[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when thinking is not an array", () => {
    const { container } = render(<ThinkingDropdown thinking={"not an array" as unknown as string[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders collapsed state by default", () => {
    render(<ThinkingDropdown thinking={["First thought", "Second thought"]} />);
    expect(screen.getByText("Second thought")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /expand thinking/i })).toBeInTheDocument();
    expect(screen.queryByTestId("react-markdown")).not.toBeInTheDocument();
  });

  it("toggles expansion when button is clicked", () => {
    render(<ThinkingDropdown thinking={["First thought", "Second thought"]} />);
    const button = screen.getByRole("button", { name: /expand thinking/i });

    // Initially collapsed
    expect(screen.queryByTestId("react-markdown")).not.toBeInTheDocument();

    // Click to expand
    fireEvent.click(button);
    expect(screen.getByRole("button", { name: /collapse thinking/i })).toBeInTheDocument();
    expect(screen.getByTestId("react-markdown")).toBeInTheDocument();

    // Click to collapse
    fireEvent.click(button);
    expect(screen.getByRole("button", { name: /expand thinking/i })).toBeInTheDocument();
    expect(screen.queryByTestId("react-markdown")).not.toBeInTheDocument();
  });

  it("displays duration when not streaming and duration is provided", () => {
    render(
      <ThinkingDropdown
        thinking={["First thought", "Second thought"]}
        isStreaming={false}
        thinkingDuration={5}
      />
    );
    expect(screen.getByText("Thought for 5s")).toBeInTheDocument();
  });

  it("displays duration as 0 when duration is 0", () => {
    render(
      <ThinkingDropdown
        thinking={["First thought", "Second thought"]}
        isStreaming={false}
        thinkingDuration={0}
      />
    );
    expect(screen.getByText("Thought for 0s")).toBeInTheDocument();
  });

  it("displays last thought header when streaming", () => {
    render(
      <ThinkingDropdown
        thinking={["First thought", "Second thought"]}
        isStreaming={true}
      />
    );
    expect(screen.getByText("Second thought")).toBeInTheDocument();
  });

  it("displays last thought header when not streaming and no duration", () => {
    render(
      <ThinkingDropdown
        thinking={["First thought", "Second thought"]}
        isStreaming={false}
      />
    );
    expect(screen.getByText("Second thought")).toBeInTheDocument();
  });

  it("displays 'Thinking...' when no thoughts available", () => {
    render(<ThinkingDropdown thinking={[""]} />);
    expect(screen.getByText("Thinking...")).toBeInTheDocument();
  });

  it("strips markdown from header text", () => {
    render(
      <ThinkingDropdown
        thinking={["**Bold thought**", "*Italic thought*", "`Code thought`"]}
      />
    );
    expect(screen.getByText("Code thought")).toBeInTheDocument();
  });

  it("extracts first sentence from last thought", () => {
    render(
      <ThinkingDropdown
        thinking={["First thought", "This is a sentence. This is another."]}
      />
    );
    expect(screen.getByText("This is a sentence.")).toBeInTheDocument();
  });

  it("limits header to 100 characters", () => {
    const longThought = "a".repeat(150);
    render(<ThinkingDropdown thinking={[longThought]} />);
    const headerElement = screen.getByRole("button").querySelector("span");
    expect(headerElement?.textContent?.length).toBeLessThanOrEqual(100);
    expect(headerElement?.textContent?.length).toBeGreaterThan(0);
  });

  it("joins thinking array with double newlines", () => {
    render(<ThinkingDropdown thinking={["Thought 1", "Thought 2"]} />);
    fireEvent.click(screen.getByRole("button", { name: /expand thinking/i }));

    const markdown = screen.getByTestId("react-markdown");
    expect(markdown.textContent).toContain("Thought 1\n\nThought 2");
  });

  it("renders markdown content when expanded", () => {
    render(<ThinkingDropdown thinking={["# Header", "Some **bold** text"]} />);
    fireEvent.click(screen.getByRole("button", { name: /expand thinking/i }));

    expect(screen.getByTestId("react-markdown")).toBeInTheDocument();
  });

  it("applies correct CSS classes and styles", () => {
    const { container } = render(
      <ThinkingDropdown thinking={["Test thought"]} />
    );

    const dropdown = container.firstChild as HTMLElement;
    expect(dropdown).toHaveClass("mb-4");

    const button = screen.getByRole("button");
    expect(button).toHaveClass("flex", "items-center", "gap-1", "text-left", "group");

    fireEvent.click(button);
    const expandedContent = screen.getByTestId("react-markdown").parentElement?.parentElement;
    expect(expandedContent).toHaveClass("mt-2", "pl-3", "rounded-sm", "opacity-70");
  });
});