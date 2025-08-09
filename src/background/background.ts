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
            textContent: element.textContent
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
- For each element, generate a public method to interact with it (e.g., \`clickLoginButton()\`, \`enterUsername(String username)\`).
- Ensure all necessary imports (\`org.openqa.selenium.*\`) are included.`;
                break;
            case 'JavaScript':
                instructions = `
- The class name should be \`${pageName}Page\`.
- Use a common test framework syntax like WebdriverIO or Cypress.
- Create a getter for each element that returns a selector object (e.g., \`get usernameInput() { return $('${'selector'}'); }\`).
- Generate methods for interaction (e.g., \`async login(user, pass)\`).`;
                break;
            case 'TypeScript':
                instructions = `
- The class name should be \`${pageName}Page\`.
- Use Playwright or a similar modern framework.
- The class should have a private readonly \`page\` property of type \`Page\`.
- For each element, create a private readonly locator property (e.g., \`private readonly usernameInput = this.page.locator('${'selector'}');\`).
- Generate public async methods for interactions (e.g., \`async enterUsername(username: string): Promise<void>\`).
- Include the necessary import for \`Page\` from \`@playwright/test\`.`;
                break;
        }
    }

    return `
You are an expert test automation engineer. Your task is to generate a Page Object Model (POM) class in ${language}.

**Page Name:** ${pageName}

**Elements with detailed information:**
${elementsJson}

**IMPORTANT NAMING GUIDELINES:**
- Review each element's details carefully (tagName, attributes, textContent).
- If the provided 'name' field seems generic (e.g., 'button1', 'input2', 'container3'), analyze the element's context:
  - Look at the element's attributes (id, class, data-testid, aria-label, etc.)
  - Consider the element's text content
  - Use the element's purpose based on its attributes and content
- Generate more meaningful names based on the element's actual purpose. For example:
  - Instead of 'button1', use 'submitButton' if it has type="submit"
  - Instead of 'input2', use 'emailInput' if it has type="email" or placeholder="Email"
  - Instead of 'container3', use 'navigationMenu' if it has class="nav-menu"
- The generated method names should reflect the element's actual function in the application.

**Instructions for ${language}:**
${instructions}

${customPrompt ? `**Additional Requirements:**\n${customPrompt}\n` : ''}
Generate only the code for the class file. Do not include any explanations, comments, or markdown formatting outside of the code itself.
    `;
}