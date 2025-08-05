# POM Generator - Chrome Extension

This Chrome extension allows you to click on web elements, capture their locators, and use the Google Gemini API to generate Page Object Model (POM) classes in Java, JavaScript, or TypeScript.

## Features

- **Real-time Locator Capture**: Click on any element on a webpage to capture its locators.
- **Editable Locator List**: View and manage the captured locators for each page in the extension popup.
- **Multi-language POM Generation**: Generate POM classes in Java, JavaScript, or TypeScript.
- **Direct Gemini API Integration**: Uses the Gemini API to generate code based on your captured elements.
- **Downloadable Code**: Export the generated POM code as a file.

## Setup Instructions

### 1. Prerequisites

- [Node.js](https://nodejs.org/) (which includes npm)
- [Google Chrome](https://www.google.com/chrome/)

### 2. Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd pom-generator
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Build the extension:**
    ```bash
    npm run build
    ```
    This will compile the TypeScript code and package all necessary files into the `dist` directory.

### 3. Get a Gemini API Key

1.  Go to [Google AI Studio](https://makersuite.google.com/app/apikey) to get your Gemini API key.
2.  Click on "**Create API key**" and copy the generated key.

### 4. Load the Extension in Chrome

1.  Open Chrome and navigate to `chrome://extensions`.
2.  Enable "**Developer mode**" using the toggle in the top-right corner.
3.  Click on the "**Load unpacked**" button.
4.  Select the `dist` directory from this project.
5.  The "POM Generator" extension should now appear in your list of extensions.

## How to Use

1.  **Pin the Extension**: Click the puzzle icon in your Chrome toolbar and pin the "POM Generator" extension for easy access.

2.  **Enter API Key**:
    - Open the extension popup.
    - Paste your Gemini API key into the input field and click "Save".

3.  **Capture Locators**:
    - Navigate to the webpage you want to work with.
    - Open the extension popup and click "**Start Capturing**".
    - Click on elements on the page. You will see a list of captured locators appear in the popup.
    - Click "**Stop Capturing**" when you are done.

4.  **Manage Locators**:
    - In the popup, you can give each captured locator a meaningful name (e.g., "usernameInput", "loginButton").
    - You can delete any unwanted locators.

5.  **Generate POM Code**:
    - Select your desired language (Java, JavaScript, or TypeScript) from the dropdown.
    - Click the "**Generate POM**" button.
    - The generated code will appear in the text area below.

6.  **Download the Code**:
    - Click the "**Download File**" button to save the generated code to your computer.

## Project Structure

-   `src/`: Contains the TypeScript source code.
    -   `background/background.ts`: Handles communication, storage, and Gemini API calls.
    -   `content/content.ts`: Injected into webpages to capture element clicks.
    -   `popup/`: Contains the HTML, CSS, and TS for the extension's popup.
    -   `shared/types.ts`: Shared type definitions.
-   `public/`: Static assets that are copied to the `dist` directory.
-   `dist/`: The bundled extension code, ready to be loaded into Chrome.
-   `webpack.config.js`: Webpack configuration for bundling the project.
-   `tsconfig.json`: TypeScript compiler configuration. 