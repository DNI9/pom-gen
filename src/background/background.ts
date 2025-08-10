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

async function generatePom(elements: CapturedElement[], language: Language, pageName: string, customGuidelines?: string, customPrompt?: string): Promise<{ pomCode?: string; dataCode?: string; pomFileName?: string; dataFileName?: string; code?: string; }> {
    const { apiKey } = await chrome.storage.local.get('apiKey');
    if (!apiKey) {
        throw new Error('API Key not found. Please set it in the extension popup.');
    }

    const detectedLanguage = detectLanguageFromPrompt(customPrompt);
    const targetLanguage = detectedLanguage || language;

    const prompt = createPrompt(elements, targetLanguage, pageName, customGuidelines, customPrompt);

    // File name helpers
    const ext = targetLanguage === 'Java' ? 'java' : targetLanguage === 'TypeScript' ? 'ts' : 'js';
    const pomFileName = `${pageName}Page.${ext}`;
    const dataFileName = `${pageName}Data.${ext}`;
    
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
                            dataFileName: { type: 'STRING' }
                        },
                        required: ['pomCode', 'dataCode'],
                        propertyOrdering: ['pomCode', 'dataCode', 'pomFileName', 'dataFileName']
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
        // Some models may still return markdown fences; sanitize and parse
        const cleaned = text.replace(/```(json)?\n/g, '').replace(/```\n?/g, '').trim();
        let parsed: any;
        try {
            parsed = JSON.parse(cleaned);
        } catch {
            // Fallback: return as a single code blob if parsing fails
            return { code: cleaned };
        }

        return {
            pomCode: parsed.pomCode,
            dataCode: parsed.dataCode,
            pomFileName: parsed.pomFileName || pomFileName,
            dataFileName: parsed.dataFileName || dataFileName,
        };

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
    
    if (customGuidelines && customGuidelines.trim()) {
        instructions = customGuidelines;
    } else {
        switch (language) {
            case 'Java':
                instructions = `
- The POM class name should be \`${pageName}Page\`.
- Use Selenium WebDriver and PageFactory.
- For each element, create a private \`WebElement\` with \`@FindBy\`.
- The Data model class name should be \`${pageName}Data\` (immutable, appropriate field types).
- Provide POM methods to fill inputs from a \`${pageName}Data\` instance.`;
                break;
            case 'JavaScript':
                instructions = `
- The POM class name should be \`${pageName}Page\` using Playwright or WebdriverIO style locators.
- Generate a plain data object type \`${pageName}Data\` for inputs; add a \`fill(data)\` helper.`;
                break;
            case 'TypeScript':
                instructions = `
- The POM class name should be \`${pageName}Page\` using Playwright with a private readonly \`page: Page\`.
- Generate a \`${pageName}Data\` interface for input fields with inferred types.
- Provide \`fill(data: ${pageName}Data)\` and element setters.`;
                break;
        }
    }

    const dataModelSection = `
From the elements JSON, identify input-capable elements (those with an \`input\` object). Infer a data model named \`${pageName}Data\` with fields using appropriate types and captured defaults.
`;

    // Final prompt instructing strict fields for structured output
    return `
You are an expert test automation engineer. Generate two separate source strings in ${language}:
1) pomCode: Source code for the POM class \`${pageName}Page\`.
2) dataCode: Source code for the Data model \`${pageName}Data\`.

Page Name: ${pageName}

Elements (with captured input values when available):
${elementsJson}

Naming and behavior:
${instructions}

${dataModelSection}
Only include pure source code in \"pomCode\" and \"dataCode\" (no markdown fences, no commentary). If relevant, also suggest sensible file names in \"pomFileName\" and \"dataFileName\".
`;
}