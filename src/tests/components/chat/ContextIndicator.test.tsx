import { render, screen } from "@testing-library/react";
import ContextIndicator from "@/components/chat/ContextIndicator";

describe("ContextIndicator", () => {
  describe("Percentage Calculation and Display", () => {
    it("should display remaining percentage as whole number when <= 95%", () => {
      render(<ContextIndicator usedTokens={100000} totalTokens={1000000} />);

      // remaining = 100 - (100000/1000000 * 100) = 90%
      expect(screen.getByText("90%")).toBeInTheDocument();
    });

    it("should display remaining percentage with 1 decimal when > 95%", () => {
      render(<ContextIndicator usedTokens={40000} totalTokens={1000000} />);

      // remaining = 100 - (40000/1000000 * 100) = 96.0%
      expect(screen.getByText("96.0%")).toBeInTheDocument();
    });

    it("should display 100.0% when no tokens are used", () => {
      render(<ContextIndicator usedTokens={0} totalTokens={1000000} />);

      expect(screen.getByText("100.0%")).toBeInTheDocument();
    });

    it("should display 0% when all tokens are used", () => {
      render(<ContextIndicator usedTokens={1000000} totalTokens={1000000} />);

      expect(screen.getByText("0%")).toBeInTheDocument();
    });

    it("should handle decimal percentages correctly", () => {
      // 45000/100000 = 45% used, 55% remaining (< 95%, so whole number)
      render(<ContextIndicator usedTokens={45000} totalTokens={100000} />);

      expect(screen.getByText("55%")).toBeInTheDocument();
    });

    it("should round correctly for values near threshold", () => {
      // 94900/1000000 = 9.49% used, 90.51% remaining
      // Since 90.51 <= 95, should display as 91% (rounded)
      render(<ContextIndicator usedTokens={94900} totalTokens={1000000} />);

      expect(screen.getByText("91%")).toBeInTheDocument();
    });

    it("should handle edge case at exactly 95% remaining", () => {
      // 50000/1000000 = 5% used, 95% remaining
      // At exactly 95%, should show whole number
      render(<ContextIndicator usedTokens={50000} totalTokens={1000000} />);

      expect(screen.getByText("95%")).toBeInTheDocument();
    });

    it("should handle edge case just above 95% remaining", () => {
      // 49999/1000000 = 4.9999% used, 95.0001% remaining
      // > 95%, should show 1 decimal
      render(<ContextIndicator usedTokens={49999} totalTokens={1000000} />);

      expect(screen.getByText("95.0%")).toBeInTheDocument();
    });
  });

  describe("Color Transitions", () => {
    it("should use green color when remaining > 70%", () => {
      const { container } = render(
        <ContextIndicator usedTokens={200000} totalTokens={1000000} />,
      );

      // remaining = 80% (green)
      const progressCircle = container.querySelectorAll("circle")[1];
      expect(progressCircle).toHaveAttribute("stroke", "#10b981");
    });

    it("should use yellow color when remaining is between 40% and 70%", () => {
      const { container } = render(
        <ContextIndicator usedTokens={500000} totalTokens={1000000} />,
      );

      // remaining = 50% (yellow)
      const progressCircle = container.querySelectorAll("circle")[1];
      expect(progressCircle).toHaveAttribute("stroke", "#eab308");
    });

    it("should use orange color when remaining is between 20% and 40%", () => {
      const { container } = render(
        <ContextIndicator usedTokens={700000} totalTokens={1000000} />,
      );

      // remaining = 30% (orange)
      const progressCircle = container.querySelectorAll("circle")[1];
      expect(progressCircle).toHaveAttribute("stroke", "#f97316");
    });

    it("should use red color when remaining <= 20%", () => {
      const { container } = render(
        <ContextIndicator usedTokens={900000} totalTokens={1000000} />,
      );

      // remaining = 10% (red)
      const progressCircle = container.querySelectorAll("circle")[1];
      expect(progressCircle).toHaveAttribute("stroke", "#ef4444");
    });

    it("should use yellow when remaining is just below 70% threshold", () => {
      const { container } = render(
        <ContextIndicator usedTokens={300001} totalTokens={1000000} />,
      );

      // remaining = 69.9999% which is <= 70%, so should be yellow
      const progressCircle = container.querySelectorAll("circle")[1];
      expect(progressCircle).toHaveAttribute("stroke", "#eab308");
    });

    it("should use orange when remaining is just below 40% threshold", () => {
      const { container } = render(
        <ContextIndicator usedTokens={600001} totalTokens={1000000} />,
      );

      // remaining = 39.9999% which is <= 40%, so should be orange
      const progressCircle = container.querySelectorAll("circle")[1];
      expect(progressCircle).toHaveAttribute("stroke", "#f97316");
    });

    it("should use red when remaining is just below 20% threshold", () => {
      const { container } = render(
        <ContextIndicator usedTokens={800001} totalTokens={1000000} />,
      );

      // remaining = 19.9999% which is <= 20%, so should be red
      const progressCircle = container.querySelectorAll("circle")[1];
      expect(progressCircle).toHaveAttribute("stroke", "#ef4444");
    });
  });

  describe("Tooltip Content", () => {
    it("should show percentage used in tooltip", () => {
      const { container } = render(
        <ContextIndicator usedTokens={123456} totalTokens={1000000} />,
      );

      // 123456/1000000 * 100 = 12.3456% used
      const indicator = container.querySelector("div[title]");
      expect(indicator).toHaveAttribute(
        "title",
        "Approximately 12.3% context window used",
      );
    });

    it("should show percentage with 1 decimal in tooltip", () => {
      const { container } = render(
        <ContextIndicator usedTokens={250000} totalTokens={1000000} />,
      );

      // (250000/1000000 * 100) = 25.0%
      const indicator = container.querySelector("div[title]");
      expect(indicator).toHaveAttribute(
        "title",
        "Approximately 25.0% context window used",
      );
    });

    it("should handle large token counts in tooltip", () => {
      const { container } = render(
        <ContextIndicator usedTokens={5000000} totalTokens={10000000} />,
      );

      // 5000000/10000000 * 100 = 50.0%
      const indicator = container.querySelector("div[title]");
      expect(indicator).toHaveAttribute(
        "title",
        "Approximately 50.0% context window used",
      );
    });

    it("should show tooltip with approximately prefix", () => {
      const { container } = render(
        <ContextIndicator usedTokens={333333} totalTokens={1000000} />,
      );

      // 333333/1000000 * 100 = 33.3333%
      const indicator = container.querySelector("div[title]");
      expect(indicator).toHaveAttribute(
        "title",
        "Approximately 33.3% context window used",
      );
    });
  });

  describe("SVG Rendering", () => {
    it("should render two circles (background and progress)", () => {
      const { container } = render(
        <ContextIndicator usedTokens={500000} totalTokens={1000000} />,
      );

      const circles = container.querySelectorAll("circle");
      expect(circles).toHaveLength(2);
    });

    it("should render background circle with correct attributes", () => {
      const { container } = render(
        <ContextIndicator usedTokens={500000} totalTokens={1000000} />,
      );

      const backgroundCircle = container.querySelectorAll("circle")[0];
      expect(backgroundCircle).toHaveAttribute("cx", "8");
      expect(backgroundCircle).toHaveAttribute("cy", "8");
      expect(backgroundCircle).toHaveAttribute("r", "6");
      expect(backgroundCircle).toHaveAttribute("fill", "none");
      expect(backgroundCircle).toHaveAttribute("stroke", "#444");
      expect(backgroundCircle).toHaveAttribute("stroke-width", "2");
    });

    it("should render progress circle with correct base attributes", () => {
      const { container } = render(
        <ContextIndicator usedTokens={500000} totalTokens={1000000} />,
      );

      const progressCircle = container.querySelectorAll("circle")[1];
      expect(progressCircle).toHaveAttribute("cx", "8");
      expect(progressCircle).toHaveAttribute("cy", "8");
      expect(progressCircle).toHaveAttribute("r", "6");
      expect(progressCircle).toHaveAttribute("fill", "none");
      expect(progressCircle).toHaveAttribute("stroke-width", "2");
      expect(progressCircle).toHaveAttribute("stroke-linecap", "round");
      expect(progressCircle).toHaveAttribute("transform", "rotate(-90 8 8)");
    });

    it("should calculate stroke-dasharray correctly for 50% remaining", () => {
      const { container } = render(
        <ContextIndicator usedTokens={500000} totalTokens={1000000} />,
      );

      // circumference = 2 * PI * 6 = ~37.699
      // 50% remaining = 18.85 37.699
      const progressCircle = container.querySelectorAll("circle")[1];
      const strokeDasharray = progressCircle.getAttribute("stroke-dasharray");

      const circumference = 2 * Math.PI * 6;
      const expectedDash = (0.5 * circumference).toString();

      expect(strokeDasharray).toContain(expectedDash.substring(0, 4));
    });

    it("should calculate stroke-dasharray correctly for 100% remaining", () => {
      const { container } = render(
        <ContextIndicator usedTokens={0} totalTokens={1000000} />,
      );

      // circumference = 2 * PI * 6
      // 100% remaining = full circumference
      const progressCircle = container.querySelectorAll("circle")[1];
      const strokeDasharray = progressCircle.getAttribute("stroke-dasharray");

      const circumference = 2 * Math.PI * 6;
      const expectedPattern = `${circumference} ${circumference}`;

      expect(strokeDasharray).toBe(expectedPattern);
    });

    it("should calculate stroke-dasharray correctly for 0% remaining", () => {
      const { container } = render(
        <ContextIndicator usedTokens={1000000} totalTokens={1000000} />,
      );

      // 0% remaining = 0 dash
      const progressCircle = container.querySelectorAll("circle")[1];
      const strokeDasharray = progressCircle.getAttribute("stroke-dasharray");

      const circumference = 2 * Math.PI * 6;
      const expectedPattern = `0 ${circumference}`;

      expect(strokeDasharray).toBe(expectedPattern);
    });

    it("should have transition styles for smooth animation", () => {
      const { container } = render(
        <ContextIndicator usedTokens={500000} totalTokens={1000000} />,
      );

      const progressCircle = container.querySelectorAll("circle")[1];
      const style = progressCircle.getAttribute("style");

      expect(style).toContain("transition");
      expect(style).toContain("stroke-dasharray");
      expect(style).toContain("stroke");
    });
  });

  describe("Edge Cases", () => {
    it("should handle very small token usage", () => {
      render(<ContextIndicator usedTokens={1} totalTokens={1000000} />);

      // remaining ≈ 99.9999% > 95%, should show 1 decimal
      expect(screen.getByText("100.0%")).toBeInTheDocument();
    });

    it("should handle very large token counts", () => {
      render(<ContextIndicator usedTokens={500000} totalTokens={10000000} />);

      // remaining = 95% exactly
      expect(screen.getByText("95%")).toBeInTheDocument();
    });

    it("should handle equal used and total tokens", () => {
      render(<ContextIndicator usedTokens={1000} totalTokens={1000} />);

      expect(screen.getByText("0%")).toBeInTheDocument();
    });

    it("should render without errors for valid props", () => {
      const { container } = render(
        <ContextIndicator usedTokens={250000} totalTokens={1000000} />,
      );

      expect(container.querySelector("svg")).toBeInTheDocument();
      expect(screen.getByText("75%")).toBeInTheDocument();
    });
  });

  describe("Component Structure", () => {
    it("should render with correct container classes", () => {
      const { container } = render(
        <ContextIndicator usedTokens={500000} totalTokens={1000000} />,
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass("flex", "items-center", "gap-1.5", "text-xs");
    });

    it("should render SVG with correct dimensions", () => {
      const { container } = render(
        <ContextIndicator usedTokens={500000} totalTokens={1000000} />,
      );

      const svg = container.querySelector("svg");
      expect(svg).toHaveAttribute("width", "16");
      expect(svg).toHaveAttribute("height", "16");
      expect(svg).toHaveAttribute("viewBox", "0 0 16 16");
    });

    it("should render percentage text with correct classes", () => {
      const { container } = render(
        <ContextIndicator usedTokens={500000} totalTokens={1000000} />,
      );

      const percentageText = container.querySelector("span");
      expect(percentageText).toHaveClass("text-gray-300", "font-medium");
    });
  });
});
