import { FC } from "react";

interface ContextIndicatorProps {
  usedTokens: number;
  totalTokens: number;
}

// Constants for the circular progress indicator
const CIRCLE_RADIUS = 6;

const COLORS = {
  GREEN: "#10b981",
  YELLOW: "#eab308",
  ORANGE: "#f97316",
  RED: "#ef4444",
};

const THRESHOLDS = {
  GREEN: 70,
  YELLOW: 40,
  ORANGE: 20,
};

/**
 * Determines the color based on remaining capacity percentage.
 * Returns green for >70%, yellow for >40%, orange for >20%, and red otherwise.
 */
const getColor = (remaining: number): string => {
  if (remaining > THRESHOLDS.GREEN) return COLORS.GREEN;
  if (remaining > THRESHOLDS.YELLOW) return COLORS.YELLOW;
  if (remaining > THRESHOLDS.ORANGE) return COLORS.ORANGE;
  return COLORS.RED;
};

/**
 * Displays a circular progress indicator showing the remaining context window capacity.
 * Color changes from green -> yellow -> orange -> red as capacity decreases.
 */
const ContextIndicator: FC<ContextIndicatorProps> = ({
  usedTokens,
  totalTokens,
}) => {
  // Validate and sanitize inputs
  // Coerce to numbers and handle NaN cases
  const sanitizedUsed = Number.isFinite(usedTokens) ? usedTokens : 0;
  const sanitizedTotal = Number.isFinite(totalTokens) ? totalTokens : 0;

  // Declare variables that will be used in the component
  let percentageUsed: number;
  let remaining: number;
  let displayRemaining: number;

  // Early return or set sensible defaults when totalTokens is 0 or invalid
  if (sanitizedTotal <= 0) {
    // When total is 0 or invalid, show 100% remaining (nothing used)
    remaining = 100;
    displayRemaining = 100;
    percentageUsed = 0;
  } else {
    // Clamp usedTokens between 0 and totalTokens
    const clampedUsed = Math.max(0, Math.min(sanitizedUsed, sanitizedTotal));

    // Calculate percentage used with decimal precision
    percentageUsed = (clampedUsed / sanitizedTotal) * 100;
    const rawRemaining = 100 - percentageUsed;

    // Clamp remaining to 0-100 range (handles edge cases)
    remaining = Math.max(0, Math.min(100, rawRemaining));

    // Store displayRemaining as a number for type consistency
    // Will format appropriately in JSX based on the remaining value
    displayRemaining = remaining;
  }

  // Calculate the stroke dash array for the circular progress
  const circumference = 2 * Math.PI * CIRCLE_RADIUS;
  const strokeDasharray = `${(remaining / 100) * circumference} ${circumference}`;

  return (
    <div
      className="flex items-center gap-1.5 text-xs"
      title={`Approximately ${percentageUsed.toFixed(1)}% context window used`}
    >
      <svg width="16" height="16" viewBox="0 0 16 16">
        {/* Background circle */}
        <circle
          cx="8"
          cy="8"
          r={CIRCLE_RADIUS}
          fill="none"
          stroke="#444"
          strokeWidth="2"
        />
        {/* Progress circle */}
        <circle
          cx="8"
          cy="8"
          r={CIRCLE_RADIUS}
          fill="none"
          stroke={getColor(remaining)}
          strokeWidth="2"
          strokeDasharray={strokeDasharray}
          strokeLinecap="round"
          transform="rotate(-90 8 8)"
          style={{ transition: "stroke-dasharray 0.3s ease, stroke 0.3s ease" }}
        />
      </svg>
      <span className="text-gray-300 font-medium">
        {remaining > 95
          ? displayRemaining.toFixed(1)
          : Math.round(displayRemaining)}
        %
      </span>
    </div>
  );
};

export default ContextIndicator;
