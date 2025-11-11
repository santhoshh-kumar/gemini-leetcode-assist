interface TestCase {
  input: Record<string, unknown>;
  output: string;
  expected: string;
}

export async function parseLeetCodeProblem() {
  const title =
    document.querySelector(".text-title-large")?.textContent?.trim() || "";

  const contentNode = document.querySelector(".elfjS");

  let description = "";
  if (contentNode) {
    // Stop before the first example section
    for (const child of Array.from(contentNode.children)) {
      if (child.matches(".example") || child.querySelector(".example")) {
        break;
      }
      description += child.outerHTML;
    }
  }

  const examples = Array.from(contentNode?.querySelectorAll("pre") || []).map(
    (pre) => pre.textContent?.trim() || "",
  );

  const constraintsHeading = [
    ...(contentNode?.querySelectorAll("strong, b") ?? []),
  ].find((el) => el.textContent?.trim() === "Constraints:");
  const constraintsElement =
    constraintsHeading?.nextElementSibling ??
    constraintsHeading?.parentElement?.nextElementSibling;
  const constraints =
    constraintsElement?.tagName === "UL" ? constraintsElement.innerHTML : "";

  const result = {
    title,
    description,
    examples,
    constraints,
  };

  return result;
}

export async function parseLeetCodetestResult(
  container?: Element,
): Promise<TestCase[]> {
  const testResultContainer =
    container || document.querySelector(".flex-1.overflow-y-auto");
  if (!testResultContainer) return [];

  // Find all headers for Input, Output, Expected
  const allDivs = Array.from(
    testResultContainer.querySelectorAll(
      "div.mb-2, div.text-sd-muted-foreground, div.flex.text-xs",
    ),
  );
  const headers = allDivs.filter((div) => {
    const text = div.textContent?.trim();
    return text === "Input" || text === "Output" || text === "Expected";
  });

  const sections: { type: string; content: Element }[] = [];
  for (const header of headers) {
    let content = header.nextElementSibling;
    if (
      !content ||
      (!content.className.includes("space-y-2") &&
        !content.className.includes("px-4") &&
        !content.className.includes("group") &&
        !content.className.includes("relative"))
    ) {
      content = header.parentElement?.nextElementSibling || null;
    }
    if (content) {
      sections.push({ type: header.textContent?.trim() || "", content });
    }
  }

  const inputs = sections.filter((s) => s.type === "Input");
  const outputs = sections.filter((s) => s.type === "Output");
  const expecteds = sections.filter((s) => s.type === "Expected");

  const testCases: TestCase[] = [];
  if (inputs.length > 0 && outputs.length > 0 && expecteds.length > 0) {
    const firstInput = inputs[0];
    const firstOutput = outputs[0];
    const firstExpected = expecteds[0];

    const visibleInputResult = parseInput(firstInput.content);
    const globalKeys = visibleInputResult.keys;

    // Parse additional collapsed if present
    if (inputs.length > 0) {
      const collapsedInput = inputs[1];
      const collapsedOutput = outputs.length > 1 ? outputs[1] : firstOutput;
      const collapsedExpected =
        expecteds.length > 1 ? expecteds[1] : firstExpected;

      const cmCollapsed = collapsedInput.content.querySelector(".cm-content");
      if (cmCollapsed) {
        const lineElements = cmCollapsed.querySelectorAll(".cm-line");
        const lines = Array.from(lineElements).map(
          (el) => el.textContent?.trim() || "",
        );
        if (
          lines.length > 0 &&
          globalKeys.length > 0 &&
          lines.length % globalKeys.length === 0
        ) {
          const numCollapsed = lines.length / globalKeys.length;
          for (let j = 0; j < numCollapsed; j++) {
            const start = j * globalKeys.length;
            const end = start + globalKeys.length;
            const testCaseLines = lines.slice(start, end);
            const input: Record<string, unknown> = {};
            for (let k = 0; k < globalKeys.length; k++) {
              const valueStr = testCaseLines[k];
              try {
                input[globalKeys[k]] = JSON.parse(valueStr);
              } catch {
                input[globalKeys[k]] = valueStr;
              }
            }
            const output = parseValue(collapsedOutput.content, j);
            const expected = parseValue(collapsedExpected.content, j);
            testCases.push({ input, output, expected });
          }
        }
      }
    }
  }

  return testCases;
}

function parseInput(contentDiv: Element): {
  parsed: Record<string, unknown>;
  keys: string[];
} {
  const cm = contentDiv.querySelector(".cm-content");
  if (cm) {
    const lineElements = cm.querySelectorAll(".cm-line");
    const lines = Array.from(lineElements).map(
      (el) => el.textContent?.trim() || "",
    );
    if (lines.some((line) => line.includes("="))) {
      // has keys
      const obj: Record<string, unknown> = {};
      const keys: string[] = [];
      for (const line of lines) {
        const parts = line.split("=");
        if (parts.length >= 2) {
          const key = parts[0].trim();
          const valueStr = parts.slice(1).join("=").trim();
          keys.push(key);
          try {
            obj[key] = JSON.parse(valueStr);
          } catch {
            obj[key] = valueStr;
          }
        }
      }
      return { parsed: obj, keys };
    } else {
      // no keys, will fill later
      return { parsed: {}, keys: [] };
    }
  } else {
    // Visible case: groups with label and value
    const groups = contentDiv.querySelectorAll(".group.relative");
    const obj: Record<string, unknown> = {};
    const keys: string[] = [];
    for (const group of groups) {
      const labelDiv = group.querySelector(".mx-3.mb-2");
      const valueDiv = group.querySelector(".font-menlo.mx-3");
      if (labelDiv && valueDiv) {
        const key = labelDiv.textContent?.replace("=", "").trim();
        const valueStr = valueDiv.textContent?.trim();
        if (key && valueStr) {
          keys.push(key);
          try {
            obj[key] = JSON.parse(valueStr);
          } catch {
            obj[key] = valueStr;
          }
        }
      }
    }
    return { parsed: obj, keys };
  }
}

function parseValue(contentDiv: Element, index: number): string {
  const cm = contentDiv.querySelector(".cm-content");
  if (cm) {
    const lineElements = cm.querySelectorAll(".cm-line");
    const lines = Array.from(lineElements).map(
      (el) => el.textContent?.trim() || "",
    );
    if (lines.length > index) {
      return lines[index];
    } else {
      return "";
    }
  } else {
    const valueDiv = contentDiv.querySelector(".font-menlo");
    const val = valueDiv?.textContent?.trim() || "";
    return val;
  }
}
