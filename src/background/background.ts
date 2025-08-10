import { CapturedElement, Language } from '../shared/types';

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.type === 'GENERATE_POM') {
        const { elements, language, pageName, customGuidelines, customPrompt } = request.payload;
        generatePom(elements, language, pageName, customGuidelines, customPrompt)
            .then(code => sendResponse({ code }))
            .catch(error => sendResponse({ error: error.message }));
        return true; // Indicates that the response is sent asynchronously
    }
});

function detectLanguageFromPrompt(customPrompt?: string): Language | null {
    if (!customPrompt) return null;
    
    const prompt = customPrompt.toLowerCase();
    
    // Look for explicit language conversion requests
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

async function generatePom(elements: CapturedElement[], language: Language, pageName: string, customGuidelines?: string, customPrompt?: string): Promise<string> {
    const { apiKey } = await chrome.storage.local.get('apiKey');
    if (!apiKey) {
        throw new Error('API Key not found. Please set it in the extension popup.');
    }

    // Detect language from custom prompt if specified
    const detectedLanguage = detectLanguageFromPrompt(customPrompt);
    const targetLanguage = detectedLanguage || language;

    const prompt = createPrompt(elements, targetLanguage, pageName, customGuidelines, customPrompt);
    
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
                }]
            }),
        });

        if (!response.ok) {
            const errorBody = await response.json();
            console.error('Gemini API Error:', errorBody);
            throw new Error(`API request failed with status ${response.status}: ${errorBody.error?.message || 'Unknown error'}`);
        }

        const data = await response.json();
        
        // Extract text from the response
        const code = data.candidates[0]?.content?.parts[0]?.text || '';
        
        // Clean up the response, removing markdown backticks if present
        return code.replace(/```(java|javascript|typescript|)\n/g, '').replace(/```\n/g, '').replace(/```/g, '').trim();

    } catch (error) {
        console.error('Failed to generate POM:', error);
        throw new Error('Failed to connect to the Gemini API. Check your network connection and API key.');
    }
}

function createPrompt(elements: CapturedElement[], language: Language, pageName: string, customGuidelines?: string, customPrompt?: string): string {
    // Create detailed elements information including all attributes
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
    
    // Use custom guidelines if provided, otherwise use default instructions
    if (customGuidelines && customGuidelines.trim()) {
        instructions = customGuidelines;
    } else {
        switch (language) {
            case 'Java':
                instructions = `
- The class name should be \`${pageName}Page\`.
- Use Selenium WebDriver and the PageFactory pattern.
- For each element, create a private \`WebElement\` field with an \`@FindBy\` annotation using its CSS selector.
- For each input element with captured value, also include a field in a separate immutable Data class \`${pageName}Data\` with appropriate types.
- Generate public methods to set inputs from a \`${pageName}Data\` instance and to perform common actions (e.g., \`fillForm(${pageName}Data data)\`).
- Ensure all necessary imports (\`org.openqa.selenium.*\`, \`org.openqa.selenium.support.*\`).`;
                break;
            case 'JavaScript':
                instructions = `
- The class name should be \`${pageName}Page\`.
- Use a common test framework syntax like Playwright or WebdriverIO.
- Create getters/locators for each element.
- Also generate a plain data object type \`${pageName}Data\` for inputs; add a \`fill(data)\` helper to set values and a \`getDefaults()\` that returns captured defaults.`;
                break;
            case 'TypeScript':
                instructions = `
- The class name should be \`${pageName}Page\`.
- Use Playwright with a private readonly \`page\: Page\`.
- For each element, create a private readonly locator property.
- Generate a \`${pageName}Data\` interface for input fields inferred from captured input types.
- Generate public async methods: \`fill(data: ${pageName}Data)\`, and element-level setters (e.g., \`setEmail(value: string)\`).
- Include necessary imports for \`Page\` from \`@playwright/test\`.`;
                break;
        }
    }

    const dataModelSection = `
From the provided elements JSON, identify input-capable elements (those having an \`input\` object). For these, infer a data model named \`${pageName}Data\` with fields using appropriate types:
- For checkbox/radio: boolean
- For select-one: string
- For select-multiple: string[]
- For number/range: number or string if ambiguous
- Otherwise: string
Use element names to derive field names (camelCase). Include default values using the captured \`input.value\` when present.

Then generate BOTH:
1) The POM class \`${pageName}Page\` with locators and interaction methods.
2) The data model (class or interface) \`${pageName}Data\` with defaults and, if applicable, a builder/static factory for defaults.
If the language favors separate files, output them one after the other in a single response.
`;

    return `
You are an expert test automation engineer. Your task is to generate a Page Object Model (POM) and a companion Data model in ${language}.

Page Name: ${pageName}

Elements with detailed information (including captured input values when available):
${elementsJson}

IMPORTANT NAMING GUIDELINES:
- Review each element's details carefully (tagName, attributes, textContent, input metadata).
- If a provided 'name' is generic, infer a more meaningful name based on context (id, class, aria-label, placeholder, value, label text).
- Method names should reflect the element's purpose.

Instructions for ${language}:
${instructions}

${dataModelSection}
${customPrompt ? `Additional Requirements:\n${customPrompt}\n` : ''}
Generate only the code for the file(s). Do not include explanations or markdown fences.`;
}