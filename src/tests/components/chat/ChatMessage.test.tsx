import { render, screen, fireEvent } from "@testing-library/react";
import ChatMessage from "@/components/chat/ChatMessage";

describe("ChatMessage", () => {
  it("renders a user message correctly", () => {
    const { container } = render(
      <ChatMessage text="Hello, world!" isUser={true} />,
    );
    const messageElement = screen.getByText("Hello, world!");
    expect(messageElement).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("user-message", "mb-4");
  });

  it("renders a bot message correctly", () => {
    const { container } = render(
      <ChatMessage text="Hi there!" isUser={false} />,
    );
    const messageElement = screen.getByText("Hi there!");
    expect(messageElement).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("bot-message", "mb-4");
  });

  it("renders a code block with a language", () => {
    const code = '```javascript\nconsole.log("hello");\n```';
    render(<ChatMessage text={code} isUser={false} />);
    expect(screen.getByText('console.log("hello");')).toBeInTheDocument();
  });

  it("renders a code block without a language", () => {
    const code = "```\nhello\n```";
    render(<ChatMessage text={code} isUser={false} />);
    expect(screen.getByText("hello")).toBeInTheDocument();
  });

  it("renders a copy button for code blocks", () => {
    const code = '```javascript\nconsole.log("hello");\n```';
    render(<ChatMessage text={code} isUser={false} />);
    expect(document.querySelector('.copy-button')).toBeInTheDocument();
  });

  it("renders user message with streaming status", () => {
    render(
      <ChatMessage text="Hello, world!" isUser={true} status="streaming" />,
    );
    const messageElement = screen.getByText("Hello, world!");
    expect(messageElement).toBeInTheDocument();
    expect(messageElement.closest(".user-message")).toBeInTheDocument();
  });

  it("renders user message with failed status", () => {
    render(<ChatMessage text="Hello, world!" isUser={true} status="failed" />);
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText("Hello, world!")).toBeInTheDocument();
  });

  it("renders user message with sending status", () => {
    render(<ChatMessage text="Hello, world!" isUser={true} status="sending" />);
    const messageElement = screen.getByText("Hello, world!");
    expect(messageElement).toBeInTheDocument();
    expect(messageElement).toHaveClass("opacity-70");
  });

  it("handles message prop shape with streaming status", () => {
    const message = {
      id: "1",
      text: "Hello from bot",
      sender: "bot" as const,
      status: "streaming" as const,
    };
    render(<ChatMessage message={message} />);
    expect(screen.getByText("Hello from bot")).toBeInTheDocument();
  });

  it("handles message prop shape with user sender and streaming status", () => {
    const message = {
      id: "1",
      text: "Hello from user",
      sender: "user" as const,
      status: "streaming" as const,
    };
    render(<ChatMessage message={message} />);
    expect(screen.getByText("Hello from user")).toBeInTheDocument();
    expect(
      screen.getByText("Hello from user").closest(".user-message"),
    ).toBeInTheDocument();
  });

  it("renders action buttons for completed bot messages", () => {
    const onCopyText = jest.fn();
    const onCopyMarkdown = jest.fn();
    const onSave = jest.fn();
    const onRetry = jest.fn();

    render(
      <ChatMessage
        text="Bot response"
        isUser={false}
        status="succeeded"
        onCopyText={onCopyText}
        onCopyMarkdown={onCopyMarkdown}
        onSave={onSave}
        onRetry={onRetry}
      />,
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(4);
    expect(screen.getByLabelText("Copy as text")).toBeInTheDocument();
    expect(screen.getByLabelText("Copy as markdown")).toBeInTheDocument();
    expect(screen.getByLabelText("Save")).toBeInTheDocument();
    expect(screen.getByLabelText("Retry")).toBeInTheDocument();
  });

  it("does not render action buttons for streaming messages", () => {
    render(
      <ChatMessage
        text="Bot response"
        isUser={false}
        status="streaming"
        onCopyText={jest.fn()}
      />,
    );

    expect(screen.queryByLabelText("Copy as text")).not.toBeInTheDocument();
  });

  it("does not render action buttons for user messages", () => {
    render(
      <ChatMessage
        text="User message"
        isUser={true}
        status="succeeded"
        onCopyText={jest.fn()}
      />,
    );

    expect(screen.queryByLabelText("Copy as text")).not.toBeInTheDocument();
  });

  it("calls onCopyText when copy text button is clicked", async () => {
    const onCopyText = jest.fn();

    render(
      <ChatMessage
        text="Bot response"
        isUser={false}
        status="succeeded"
        onCopyText={onCopyText}
      />,
    );

    const copyButton = screen.getByLabelText("Copy as text");
    fireEvent.click(copyButton);

    expect(onCopyText).toHaveBeenCalled();
  });

  it("calls onCopyMarkdown when copy markdown button is clicked", () => {
    const onCopyMarkdown = jest.fn();

    render(
      <ChatMessage
        text="Bot response"
        isUser={false}
        status="succeeded"
        onCopyMarkdown={onCopyMarkdown}
      />,
    );

    const copyMarkdownButton = screen.getByLabelText("Copy as markdown");
    fireEvent.click(copyMarkdownButton);

    expect(onCopyMarkdown).toHaveBeenCalled();
  });

  it("calls onSave when save button is clicked", () => {
    const onSave = jest.fn();

    render(
      <ChatMessage
        text="Bot response"
        isUser={false}
        status="succeeded"
        onSave={onSave}
      />,
    );

    const saveButton = screen.getByLabelText("Save");
    fireEvent.click(saveButton);

    expect(onSave).toHaveBeenCalled();
  });

  it("calls onRetry when retry button in actions is clicked", () => {
    const onRetry = jest.fn();

    render(
      <ChatMessage
        text="Bot response"
        isUser={false}
        status="succeeded"
        onRetry={onRetry}
      />,
    );

    const retryButton = screen.getByLabelText("Retry");
    fireEvent.click(retryButton);

    expect(onRetry).toHaveBeenCalled();
  });

  it("renders error message with retry button for failed status", () => {
    const onRetry = jest.fn();

    render(
      <ChatMessage
        text="Error occurred"
        isUser={false}
        status="failed"
        onRetry={onRetry}
      />,
    );

    expect(screen.getByText("Error occurred")).toBeInTheDocument();
    const retryButton = screen.getByRole("button", { name: /retry/i });
    expect(retryButton).toBeInTheDocument();

    fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalled();
  });

  it("applies error-message class for failed messages", () => {
    const { container } = render(
      <ChatMessage text="Error occurred" isUser={false} status="failed" />,
    );

    const errorDiv = container.querySelector(".error-message");
    expect(errorDiv).toBeInTheDocument();
  });

  it("displays feedback message when feedback prop is provided", () => {
    render(
      <ChatMessage
        text="Bot response"
        isUser={false}
        status="succeeded"
        feedback="Copied text!"
      />,
    );

    expect(screen.getByText("Copied text!")).toBeInTheDocument();
  });

  it("handles message prop with isUser field", () => {
    const message = {
      id: "1",
      text: "Hello from user",
      isUser: true,
      status: "succeeded" as const,
    };
    render(<ChatMessage message={message} />);
    expect(screen.getByText("Hello from user")).toBeInTheDocument();
    expect(
      screen.getByText("Hello from user").closest(".user-message"),
    ).toBeInTheDocument();
  });

  it("prioritizes isUser over sender field", () => {
    const message = {
      id: "1",
      text: "Hello",
      isUser: true,
      sender: "bot" as const,
    };
    render(<ChatMessage message={message} />);
    // Should render as user message despite sender being "bot"
    expect(screen.getByText("Hello").closest(".user-message")).toBeInTheDocument();
  });
});
