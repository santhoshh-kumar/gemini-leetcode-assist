module.exports = {
  testEnvironment: "jsdom",
  transform: {
    "^.+\\.(js|jsx|ts|tsx)$": "babel-jest",
  },
  transformIgnorePatterns: [
    "/node_modules/(?!(react-markdown|vfile|unist-util-stringify-position|unified|bail|is-plain-obj|decode-named-character-reference|remark-parse|mdast-util-from-markdown|micromark|micromark-util-decode-numeric-character-reference|micromark-util-encode|micromark-util-html-tag-name|micromark-util-sanitize-uri|micromark-util-symbol|parse-entities|ccount|escape-string-regexp|markdown-table|trim-lines|devlop|hast-util-to-jsx-runtime|@google/genai|rehype-raw|rehype-sanitize|hast-util-sanitize)/)",
  ],
  moduleNameMapper: {
    "^@google/genai$": "<rootDir>/src/tests/mocks/google-genai.ts",
    "\\.(css|less|scss|sass)$": "identity-obj-proxy",
    "^@/(.*)$": "<rootDir>/src/$1",
    "^react-markdown$": "<rootDir>/src/tests/mocks/react-markdown.tsx",
    "^react-syntax-highlighter$":
      "<rootDir>/src/tests/mocks/react-syntax-highlighter.tsx",
    "^react-syntax-highlighter/dist/esm/styles/prism$":
      "<rootDir>/src/tests/mocks/syntax-highlighter-styles.ts",
    "^remark-gfm$": "<rootDir>/src/tests/mocks/remark-gfm.ts",
    "^rehype-raw$": "<rootDir>/src/tests/mocks/rehype-raw.ts",
    "^rehype-sanitize$": "<rootDir>/src/tests/mocks/rehype-sanitize.ts",
  },
  setupFilesAfterEnv: ["<rootDir>/src/tests/setupTests.ts"],
  collectCoverage: true,
  coverageReporters: ["json", "lcov", "text", "clover"],
  coverageDirectory: "coverage",
};
