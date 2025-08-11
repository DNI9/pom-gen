import { CapturedElement, Language } from '../shared/types';

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.type === 'GENERATE_POM') {
        const { elements, language, pageName, customGuidelines, customPrompt } = request.payload;
        generatePom(elements, language, pageName, customGuidelines, customPrompt)
            .then(result => sendResponse(result))
            .catch(error => sendResponse({ error: error.message }));
        return true; // Indicates that the response is sent asynchronously
    }
});

function detectLanguageFromPrompt(customPrompt?: string): Language | null {
    if (!customPrompt) return null;
    
    const prompt = customPrompt.toLowerCase();
    
    const languagePatterns = [
        { pattern: /(?:convert|change|rewrite|generate|make|use|switch)\s+(?:to|in|as|using)?\s*typescript/i, language: 'TypeScript' as Language },
        { pattern: /(?:convert|change|rewrite|generate|make|use|switch)\s+(?:to|in|as|using)?\s*javascript/i, language: 'JavaScript' as Language },
        { pattern: /(?:convert|change|rewrite|generate|make|use|switch)\s+(?:to|in|as|using)?\s*java(?!script)/i, language: 'Java' as Language },
        { pattern: /^typescript[\s:]/i, language: 'TypeScript' as Language },
        { pattern: /^javascript[\s:]/i, language: 'JavaScript' as Language },
        { pattern: /^java[\s:]/i, language: 'Java' as Language },
    ];
    
    for (const { pattern, language } of languagePatterns) {
        if (pattern.test(customPrompt)) {
            return language;
        }
    }
    
    return null;
}

async function generatePom(
    elements: CapturedElement[],
    language: Language,
    pageName: string,
    customGuidelines?: string,
    customPrompt?: string
): Promise<{ pomCode?: string; dataCode?: string; pomFileName?: string; dataFileName?: string; dataFileContent?: string; code?: string; }> {
    const { apiKey } = await chrome.storage.local.get('apiKey');
    if (!apiKey) {
        throw new Error('API Key not found. Please set it in the extension popup.');
    }

    const detectedLanguage = detectLanguageFromPrompt(customPrompt);
    const targetLanguage = detectedLanguage || language;

    const prompt = createPrompt(elements, targetLanguage, pageName, customGuidelines, customPrompt);

    const hasAnyInput = elements.some(el => el.input !== undefined);

    const ext = targetLanguage === 'Java' ? 'java' : targetLanguage === 'TypeScript' ? 'ts' : 'js';
    const pomFileName = `${pageName}Page.${ext}`;
    const dataFileNameFallback = `${pageName}Data.json`;
    
    const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

    try {
        const response = await fetch(`${API_URL}?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: 'OBJECT',
                        properties: {
                            pomCode: { type: 'STRING' },
                            dataCode: { type: 'STRING' },
                            pomFileName: { type: 'STRING' },
                            dataFileName: { type: 'STRING' },
                            dataFileContent: { type: 'STRING' }
                        },
                        required: hasAnyInput ? ['pomCode', 'dataCode', 'dataFileContent'] : ['pomCode', 'dataCode'],
                        propertyOrdering: ['pomCode', 'dataCode', 'pomFileName', 'dataFileName', 'dataFileContent']
                    }
                }
            }),
        });

        if (!response.ok) {
            const errorBody = await response.json();
            console.error('Gemini API Error:', errorBody);
            throw new Error(`API request failed with status ${response.status}: ${errorBody.error?.message || 'Unknown error'}`);
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const cleaned = text.replace(/```(json)?\n/g, '').replace(/```\n?/g, '').trim();
        let parsed: any;
        try {
            parsed = JSON.parse(cleaned);
        } catch {
            return { code: cleaned };
        }

        return {
            pomCode: parsed.pomCode,
            dataCode: parsed.dataCode,
            pomFileName: parsed.pomFileName || pomFileName,
            dataFileName: parsed.dataFileName || (parsed.dataFileContent ? dataFileNameFallback : undefined),
            dataFileContent: parsed.dataFileContent,
        };

    } catch (error) {
        console.error('Failed to generate POM:', error);
        throw new Error('Failed to connect to the Gemini API. Check your network connection and API key.');
    }
}

function createPrompt(
    elements: CapturedElement[],
    language: Language,
    pageName: string,
    customGuidelines?: string,
    customPrompt?: string
): string {
    const elementsDetails = elements.map(element => {
        return {
            name: element.name,
            selector: element.selector,
            tagName: element.tagName,
            attributes: element.attributes,
            textContent: element.textContent,
            input: element.input ? {
                type: element.input.type,
                value: element.input.value,
                nameAttr: element.input.nameAttr,
                placeholder: element.input.placeholder,
                labelText: element.input.labelText,
            } : undefined,
        };
    });
    
    const elementsJson = JSON.stringify(elementsDetails, null, 2);

    let instructions = '';
    
    if (customGuidelines && customGuidelines.trim()) {
        instructions = customGuidelines;
    } else {
        switch (language) {
            case 'Java':
                instructions = `
- The POM class name should be \`${pageName}Page\`.
- Use Selenium WebDriver and PageFactory.
- Create \`WebElement\`s with \`@FindBy\`.
- The Data class name should be \`${pageName}Data\` with appropriate types.
- Provide POM helpers to fill inputs from a \`${pageName}Data\` instance.`;
                break;
            case 'JavaScript':
                instructions = `
- The POM class name should be \`${pageName}Page\` using Playwright/WebdriverIO style locators.
- Generate a data object type \`${pageName}Data\` and a \`fill(data)\` helper.`;
                break;
            case 'TypeScript':
                instructions = `
- The POM class name should be \`${pageName}Page\` using Playwright with a private readonly \`page: Page\`.
- Generate a \`${pageName}Data\` interface for input fields with inferred types, plus \`fill(data)\`.`;
                break;
        }
    }

    const dataModelSection = `
From the elements JSON, identify input-capable elements (those with an \`input\` object). Infer a data model named \`${pageName}Data\` with fields using appropriate types and captured defaults.
Also generate a separate test data file string named \"dataFileContent\" that contains default values for these fields.
- Default format: JSON (pretty-printed)
- If user guidelines or prompt explicitly request another format (e.g., YAML), produce that format instead.
- Ensure the data keys match the \`${pageName}Data\` fields.
`;

    return `
Output a JSON object with fields: pomCode, dataCode, optional pomFileName, optional dataFileName, and optional dataFileContent.
- pomCode: Source for class \"${pageName}Page\" in ${language}.
- dataCode: Source for \"${pageName}Data\" (class/interface) in ${language}.
- dataFileContent: A standalone data file with defaults (JSON by default; use YAML or other only if explicitly requested by the user guidelines/prompt).
- If you provide file names, use pomFileName and dataFileName; otherwise omit.

Context:
Page Name: ${pageName}
Elements (with captured input values when available):
${elementsJson}

Guidance:
${instructions}

${dataModelSection}

Code Formatting Rules:
- IMPORTANT: Generate properly formatted, readable code with correct indentation and line breaks.
- Each import statement must be on its own line.
- Each method/function must start on a new line.
- Use proper indentation (2 or 4 spaces consistently).
- Opening braces { should be followed by a newline.
- Closing braces } should be on their own line.
- Add blank lines between methods/functions for readability.
- For Java: Follow standard Java code conventions.
- For TypeScript/JavaScript: Follow standard JS/TS conventions.
- Example of proper formatting:
  import org.openqa.selenium.WebDriver;
  import org.openqa.selenium.WebElement;
  
  public class LoginPage {
    private WebDriver driver;
    
    public LoginPage(WebDriver driver) {
      this.driver = driver;
    }
    
    public void enterUsername(String username) {
      usernameInput.sendKeys(username);
    }
  }

General Rules:
- Do not include markdown fences or commentary in any field.
- Return valid escaped JSON for the outer response.
- Ensure all code is properly formatted with newlines and indentation.
${customPrompt ? `User Addendum:\n${customPrompt}\n` : ''}`;
}