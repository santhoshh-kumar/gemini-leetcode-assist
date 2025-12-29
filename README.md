# LeetCode Assist (Powered by Gemini)

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-Coming%20Soon-orange)](https://chrome.google.com/webstore)
[![Made with React](https://img.shields.io/badge/Made%20with-React-61dafb.svg)](https://react.dev)
[![Powered by Gemini](https://img.shields.io/badge/AI-Gemini-4285F4)](https://deepmind.google/technologies/gemini/)

An AI-powered Chrome extension designed to enhance your LeetCode problem-solving experience.  
Built with **React, Redux, TypeScript, and TailwindCSS**, it integrates seamlessly with the LeetCode problem interface to provide **solution-free socratic questions/hints like a mentor** to improve your problem-solving skills.

<img width="852" height="898" alt="Screenshot from 2025-12-08 20-33-32" src="https://github.com/user-attachments/assets/4641c1e3-c585-4513-a54c-32078a2e31bd" />


## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm
- xvfb (for E2E testing)

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/santhoshh-kumar/gemini-leetcode-assist.git
    ```
2.  Install the dependencies:
    ```bash
    npm install
    ```

### Building the Extension

```bash
npm run build
```

This will create a `dist` directory with the production-ready extension files.

### Running the Build in Browser (Developer Mode)

1. Open your browser’s **Extensions** page.
2. Enable **Developer mode** (toggle found on the extensions page).
3. Click **Load unpacked** (or **Load unpacked extension**).
4. Select the generated **`dist/`** folder.
5. Confirm the extension appears in the extensions list and is **enabled**.
6. After making changes and running **`npm run build`** again, click **Reload** for the extension on the extensions page to apply the updated **`dist/`** files.

### Testing

#### Unit Tests

```bash
npm run test
```

This will run the unit tests using Jest.

#### E2E Tests

The E2E tests use Puppeteer to simulate user interactions in a real browser environment. They run in a headless browser using `xvfb`.

```bash
npm run test:e2e
```
