import {
  parseLeetCodeProblem,
  parseLeetCodetestResult,
} from "../../scripts/content-script/parser";

describe("parseLeetCodeProblem", () => {
  beforeEach(() => {
    // Clear the DOM before each test
    document.body.innerHTML = "";
  });

  it("should parse the LeetCode problem page correctly", async () => {
    // Set up the mock DOM
    document.body.innerHTML = `
      <div>
        <div class="text-title-large">1. Two Sum</div>
        <div class="elfjS">
          <div><p>Given an array of integers...</p></div>
          <div class="example">Example 1</div>
          <pre>Example 1 Content</pre>
          <strong>Constraints:</strong>
          <ul><li>Constraint 1</li></ul>
        </div>
      </div>
    `;

    const problem = await parseLeetCodeProblem();

    expect(problem.title).toBe("1. Two Sum");
    expect(problem.description).toContain(
      "<p>Given an array of integers...</p>",
    );
    expect(problem.examples).toEqual(["Example 1 Content"]);
    expect(problem.constraints).toBe("<li>Constraint 1</li>");
  });

  it("should handle missing elements gracefully", async () => {
    // No DOM elements are present
    const problem = await parseLeetCodeProblem();

    expect(problem.title).toBe("");
    expect(problem.description).toBe("");
    expect(problem.examples).toEqual([]);
    expect(problem.constraints).toBe("");
  });

  it("should correctly parse a description that ends before the first example", async () => {
    document.body.innerHTML = `
      <div>
        <div class="elfjS">
          <p>Part 1 of description</p>
          <p>Part 2 of description</p>
          <div class="example">Example starts here</div>
          <p>This part should not be in the description</p>
        </div>
      </div>
    `;

    const problem = await parseLeetCodeProblem();

    expect(problem.description).toBe(
      "<p>Part 1 of description</p><p>Part 2 of description</p>",
    );
    expect(problem.description).not.toContain(
      "This part should not be in the description",
    );
  });

  it("should parse constraints from b element", async () => {
    document.body.innerHTML = `
      <div>
        <div class="elfjS">
          <p>Description text</p>
          <b>Constraints:</b>
          <ul><li>Constraint from b tag</li></ul>
        </div>
      </div>
    `;

    const problem = await parseLeetCodeProblem();
    expect(problem.constraints).toBe("<li>Constraint from b tag</li>");
  });

  it("should handle multiple examples", async () => {
    document.body.innerHTML = `
      <div>
        <div class="elfjS">
          <pre>Example 1</pre>
          <pre>Example 2</pre>
          <pre>Example 3</pre>
        </div>
      </div>
    `;

    const problem = await parseLeetCodeProblem();
    expect(problem.examples).toEqual(["Example 1", "Example 2", "Example 3"]);
  });

  it("should handle nested example structure", async () => {
    document.body.innerHTML = `
      <div>
        <div class="elfjS">
          <div><p>Description</p></div>
          <div>
            <div class="example">Example section</div>
          </div>
        </div>
      </div>
    `;

    const problem = await parseLeetCodeProblem();
    expect(problem.description).toBe("<div><p>Description</p></div>");
  });
});

describe("parseLeetCodetestResult", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("should return empty array when container is not found", async () => {
    const result = await parseLeetCodetestResult();
    expect(result).toEqual([]);
  });

  it("should parse compile error with document.body container", async () => {
    document.body.innerHTML = `
      <div data-e2e-locator="console-result">Compile Error</div>
      <div class="font-menlo whitespace-pre-wrap break-all text-xs text-red-60 dark:text-red-60">
        Line 5: Char 12: error: expected ';' before '}' token
      </div>
    `;

    const result = await parseLeetCodetestResult(document.body);
    expect(result).toEqual([
      {
        input: { "NA (compile error)": "NA (compile error)" },
        output:
          "Compile Error: Line 5: Char 12: error: expected ';' before '}' token",
        expected: "NA (compile error)",
      },
    ]);
  });

  it("should parse runtime error with input extraction", async () => {
    document.body.innerHTML = `
      <div data-e2e-locator="console-result">Runtime Error</div>
      <div class="font-menlo whitespace-pre-wrap break-all text-xs text-red-60 dark:text-red-60">
        Line 10: IndexError: list index out of range
      </div>
      <div class="group relative rounded-lg bg-fill-4 dark:bg-dark-fill-4">
        <div class="mx-3 mb-2 text-xs text-label-3 dark:text-dark-label-3">nums =</div>
        <div class="font-menlo mx-3 whitespace-pre-wrap break-all leading-5 text-label-1 dark:text-dark-label-1">[2,7,11,15]</div>
      </div>
      <div class="group relative rounded-lg bg-fill-4 dark:bg-dark-fill-4">
        <div class="mx-3 mb-2 text-xs text-label-3 dark:text-dark-label-3">target =</div>
        <div class="font-menlo mx-3 whitespace-pre-wrap break-all leading-5 text-label-1 dark:text-dark-label-1">9</div>
      </div>
    `;

    const result = await parseLeetCodetestResult(document.body);
    expect(result).toEqual([
      {
        input: {
          nums: [2, 7, 11, 15],
          target: 9,
        },
        output: "Runtime Error: Line 10: IndexError: list index out of range",
        expected: null,
      },
    ]);
  });

  it("should parse compile error with testResultContainer", async () => {
    const container = document.createElement("div");
    container.className = "flex-1 overflow-y-auto";
    container.innerHTML = `
      <div data-e2e-locator="console-result">Compile Error</div>
      <div class="font-menlo whitespace-pre-wrap break-all text-xs text-red-60 dark:text-red-60">
        Syntax error: unexpected token
      </div>
    `;
    document.body.appendChild(container);

    const result = await parseLeetCodetestResult(container);
    expect(result).toEqual([
      {
        input: { "NA (compile error)": "NA (compile error)" },
        output: "Compile Error: Syntax error: unexpected token",
        expected: "NA (compile error)",
      },
    ]);
  });

  it("should parse normal test cases with visible input/output/expected", async () => {
    const container = document.createElement("div");
    container.className = "flex-1 overflow-y-auto";
    container.innerHTML = `
      <div class="mb-2">Input</div>
      <div class="space-y-2">
        <div class="group relative">
          <div class="mx-3 mb-2">nums =</div>
          <div class="font-menlo mx-3">[2,7,11,15]</div>
        </div>
        <div class="group relative">
          <div class="mx-3 mb-2">target =</div>
          <div class="font-menlo mx-3">9</div>
        </div>
      </div>
      <div class="mb-2">Output</div>
      <div class="px-4">
        <div class="font-menlo">[0,1]</div>
      </div>
      <div class="mb-2">Expected</div>
      <div class="px-4">
        <div class="font-menlo">[0,1]</div>
      </div>
      <div class="mb-2">Input</div>
      <div class="group">
        <div class="cm-content">
          <div class="cm-line">[3,2,4]</div>
          <div class="cm-line">6</div>
        </div>
      </div>
      <div class="mb-2">Output</div>
      <div class="relative">
        <div class="cm-content">
          <div class="cm-line">[1,2]</div>
        </div>
      </div>
      <div class="mb-2">Expected</div>
      <div class="relative">
        <div class="cm-content">
          <div class="cm-line">[1,2]</div>
        </div>
      </div>
    `;
    document.body.appendChild(container);

    const result = await parseLeetCodetestResult(container);
    expect(result).toEqual([
      {
        input: {
          nums: [3, 2, 4],
          target: 6,
        },
        output: "[1,2]",
        expected: "[1,2]",
      },
    ]);
  });

  it("should parse multiple collapsed test cases", async () => {
    const container = document.createElement("div");
    container.className = "flex-1 overflow-y-auto";
    container.innerHTML = `
      <div class="mb-2">Input</div>
      <div class="space-y-2">
        <div class="group relative">
          <div class="mx-3 mb-2">nums =</div>
          <div class="font-menlo mx-3">[2,7]</div>
        </div>
        <div class="group relative">
          <div class="mx-3 mb-2">target =</div>
          <div class="font-menlo mx-3">9</div>
        </div>
      </div>
      <div class="mb-2">Output</div>
      <div class="px-4"><div class="font-menlo">[0,1]</div></div>
      <div class="mb-2">Expected</div>
      <div class="px-4"><div class="font-menlo">[0,1]</div></div>
      <div class="mb-2">Input</div>
      <div class="group">
        <div class="cm-content">
          <div class="cm-line">[3,2,4]</div>
          <div class="cm-line">6</div>
          <div class="cm-line">[1,2,3]</div>
          <div class="cm-line">5</div>
        </div>
      </div>
      <div class="mb-2">Output</div>
      <div class="relative">
        <div class="cm-content">
          <div class="cm-line">[1,2]</div>
          <div class="cm-line">[0,2]</div>
        </div>
      </div>
      <div class="mb-2">Expected</div>
      <div class="relative">
        <div class="cm-content">
          <div class="cm-line">[1,2]</div>
          <div class="cm-line">[0,2]</div>
        </div>
      </div>
    `;
    document.body.appendChild(container);

    const result = await parseLeetCodetestResult(container);
    expect(result).toEqual([
      {
        input: { nums: [3, 2, 4], target: 6 },
        output: "[1,2]",
        expected: "[1,2]",
      },
      {
        input: { nums: [1, 2, 3], target: 5 },
        output: "[0,2]",
        expected: "[0,2]",
      },
    ]);
  });

  it("should handle input with keys in cm-content", async () => {
    const container = document.createElement("div");
    container.className = "flex-1 overflow-y-auto";
    container.innerHTML = `
      <div class="mb-2">Input</div>
      <div class="space-y-2">
        <div class="cm-content">
          <div class="cm-line">nums = [1,2,3]</div>
          <div class="cm-line">target = 4</div>
        </div>
      </div>
      <div class="mb-2">Output</div>
      <div class="px-4"><div class="font-menlo">[0,2]</div></div>
      <div class="mb-2">Expected</div>
      <div class="px-4"><div class="font-menlo">[0,2]</div></div>
      <div class="mb-2">Input</div>
      <div class="group">
        <div class="cm-content">
          <div class="cm-line">[5,6,7]</div>
          <div class="cm-line">13</div>
        </div>
      </div>
      <div class="mb-2">Output</div>
      <div class="relative">
        <div class="cm-content">
          <div class="cm-line">[1,2]</div>
        </div>
      </div>
      <div class="mb-2">Expected</div>
      <div class="relative">
        <div class="cm-content">
          <div class="cm-line">[1,2]</div>
        </div>
      </div>
    `;
    document.body.appendChild(container);

    const result = await parseLeetCodetestResult(container);
    expect(result).toEqual([
      {
        input: { nums: [5, 6, 7], target: 13 },
        output: "[1,2]",
        expected: "[1,2]",
      },
    ]);
  });

  it("should handle cm-content without keys when line count doesn't match", async () => {
    const container = document.createElement("div");
    container.className = "flex-1 overflow-y-auto";
    container.innerHTML = `
      <div class="mb-2">Input</div>
      <div class="space-y-2">
        <div class="group relative">
          <div class="mx-3 mb-2">x =</div>
          <div class="font-menlo mx-3">1</div>
        </div>
        <div class="group relative">
          <div class="mx-3 mb-2">y =</div>
          <div class="font-menlo mx-3">2</div>
        </div>
      </div>
      <div class="mb-2">Output</div>
      <div class="px-4"><div class="font-menlo">result</div></div>
      <div class="mb-2">Expected</div>
      <div class="px-4"><div class="font-menlo">expected</div></div>
      <div class="mb-2">Input</div>
      <div class="group">
        <div class="cm-content">
          <div class="cm-line">[1,2,3]</div>
          <div class="cm-line">5</div>
          <div class="cm-line">extra line</div>
        </div>
      </div>
      <div class="mb-2">Output</div>
      <div class="group">
        <div class="cm-content">
          <div class="cm-line">result2</div>
        </div>
      </div>
      <div class="mb-2">Expected</div>
      <div class="group">
        <div class="cm-content">
          <div class="cm-line">expected2</div>
        </div>
      </div>
    `;
    document.body.appendChild(container);

    const result = await parseLeetCodetestResult(container);
    // Should return empty because line count (3) doesn't divide evenly by key count (2)
    expect(result).toEqual([]);
  });

  it("should handle output with cm-content but insufficient lines", async () => {
    const container = document.createElement("div");
    container.className = "flex-1 overflow-y-auto";
    container.innerHTML = `
      <div class="mb-2">Input</div>
      <div class="space-y-2">
        <div class="group relative">
          <div class="mx-3 mb-2">x =</div>
          <div class="font-menlo mx-3">5</div>
        </div>
      </div>
      <div class="mb-2">Output</div>
      <div class="px-4"><div class="font-menlo">result</div></div>
      <div class="mb-2">Expected</div>
      <div class="px-4"><div class="font-menlo">expected</div></div>
      <div class="mb-2">Input</div>
      <div class="group">
        <div class="cm-content">
          <div class="cm-line">10</div>
        </div>
      </div>
      <div class="mb-2">Output</div>
      <div class="relative">
        <div class="cm-content">
          <div class="cm-line">output1</div>
        </div>
      </div>
      <div class="mb-2">Expected</div>
      <div class="relative">
        <div class="cm-content"></div>
      </div>
    `;
    document.body.appendChild(container);

    const result = await parseLeetCodetestResult(container);
    expect(result).toEqual([
      {
        input: { x: 10 },
        output: "output1",
        expected: "",
      },
    ]);
  });

  it("should return empty array when sections don't have proper structure", async () => {
    const container = document.createElement("div");
    container.className = "flex-1 overflow-y-auto";
    container.innerHTML = `
      <div class="text-sd-muted-foreground">Input</div>
      <div><div>Some content</div></div>
      <div class="flex text-xs">Output</div>
      <div><div>Some output</div></div>
    `;
    document.body.appendChild(container);

    const result = await parseLeetCodetestResult(container);
    // Should return empty because sections don't match expected structure
    expect(result).toEqual([]);
  });

  it("should handle parse errors in JSON values gracefully", async () => {
    const container = document.createElement("div");
    container.className = "flex-1 overflow-y-auto";
    container.innerHTML = `
      <div class="mb-2">Input</div>
      <div class="space-y-2">
        <div class="group relative">
          <div class="mx-3 mb-2">invalidJson =</div>
          <div class="font-menlo mx-3">{invalid: json}</div>
        </div>
      </div>
      <div class="mb-2">Output</div>
      <div class="px-4"><div class="font-menlo">result</div></div>
      <div class="mb-2">Expected</div>
      <div class="px-4"><div class="font-menlo">expected</div></div>
      <div class="mb-2">Input</div>
      <div class="group">
        <div class="cm-content">
          <div class="cm-line">{more: invalid}</div>
        </div>
      </div>
      <div class="mb-2">Output</div>
      <div class="relative">
        <div class="cm-content">
          <div class="cm-line">output</div>
        </div>
      </div>
      <div class="mb-2">Expected</div>
      <div class="relative">
        <div class="cm-content">
          <div class="cm-line">expected</div>
        </div>
      </div>
    `;
    document.body.appendChild(container);

    const result = await parseLeetCodetestResult(container);
    expect(result).toEqual([
      {
        input: { invalidJson: "{more: invalid}" },
        output: "output",
        expected: "expected",
      },
    ]);
  });

  it("should handle missing error element in compile error", async () => {
    document.body.innerHTML = `
      <div data-e2e-locator="console-result">Compile Error</div>
    `;

    const result = await parseLeetCodetestResult(document.body);
    expect(result).toEqual([
      {
        input: { "NA (compile error)": "NA (compile error)" },
        output: "Compile Error: Unknown compile error",
        expected: "NA (compile error)",
      },
    ]);
  });

  it("should handle missing error element in runtime error", async () => {
    document.body.innerHTML = `
      <div data-e2e-locator="console-result">Runtime Error</div>
    `;

    const result = await parseLeetCodetestResult(document.body);
    expect(result).toEqual([
      {
        input: {},
        output: "Runtime Error: Unknown runtime error",
        expected: null,
      },
    ]);
  });

  it("should handle input with value containing equals sign", async () => {
    const container = document.createElement("div");
    container.className = "flex-1 overflow-y-auto";
    container.innerHTML = `
      <div class="mb-2">Input</div>
      <div class="space-y-2">
        <div class="group relative">
          <div class="mx-3 mb-2">x =</div>
          <div class="font-menlo mx-3">5</div>
        </div>
      </div>
      <div class="mb-2">Output</div>
      <div class="px-4"><div class="font-menlo">true</div></div>
      <div class="mb-2">Expected</div>
      <div class="px-4"><div class="font-menlo">true</div></div>
      <div class="mb-2">Input</div>
      <div class="group">
        <div class="cm-content">
          <div class="cm-line">a=b+c</div>
        </div>
      </div>
      <div class="mb-2">Output</div>
      <div class="group">
        <div class="cm-content">
          <div class="cm-line">true</div>
        </div>
      </div>
      <div class="mb-2">Expected</div>
      <div class="group">
        <div class="cm-content">
          <div class="cm-line">true</div>
        </div>
      </div>
    `;
    document.body.appendChild(container);

    const result = await parseLeetCodetestResult(container);
    // Value with = in it should be parsed correctly (as the value part after first key)
    expect(result.length).toBeGreaterThan(0);
    if (result.length > 0) {
      expect(result[0].input).toHaveProperty("x");
      expect(result[0].input.x).toBe("a=b+c");
    }
  });
});
