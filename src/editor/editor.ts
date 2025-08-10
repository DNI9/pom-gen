import { CapturedElement, Language } from '../shared/types';

declare global {
    interface Window {
        Prism: any;
    }
}

// State management
let elements: CapturedElement[] = [];
let currentUrl: string = '';
let pomCode: string | undefined;
let dataCode: string | undefined;
let pomFileName: string | undefined;
let dataFileName: string | undefined;
let activeTab: 'pom' | 'data' = 'pom';

// DOM Elements
const pageUrlElement = document.getElementById('pageUrl') as HTMLElement;
const elementCountElement = document.getElementById('elementCount') as HTMLElement;
const elementsListElement = document.getElementById('elementsList') as HTMLElement;
const regenerateCodeButton = document.getElementById('regenerateCode') as HTMLButtonElement;
const addElementButton = document.getElementById('addElement') as HTMLButtonElement;
const copyCodeButton = document.getElementById('copyCode') as HTMLButtonElement;
const downloadCodeButton = document.getElementById('downloadCode') as HTMLButtonElement;
const customGuidelinesTextarea = document.getElementById('customGuidelines') as HTMLTextAreaElement;
const codeContentElement = document.getElementById('codeContent') as HTMLElement;
const codeLoadingElement = document.getElementById('codeLoading') as HTMLElement;
const customPromptInput = document.getElementById('customPromptInput') as HTMLInputElement;

// Tabs container (create dynamically since HTML has one code block initially)
let tabsContainer: HTMLDivElement | null = null;
let pomPreEl: HTMLElement | null = null;
let dataPreEl: HTMLElement | null = null;

// Initialize editor
async function initializeEditor() {
    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    currentUrl = urlParams.get('url') || '';
    
    // Display page URL
    if (pageUrlElement && currentUrl) {
        pageUrlElement.textContent = currentUrl;
        pageUrlElement.title = currentUrl;
    }
    
    // Load elements from storage
    await loadElements();
    
    // Load custom guidelines
    const { customGuidelines } = await chrome.storage.local.get('customGuidelines');
    if (customGuidelines && customGuidelinesTextarea) {
        customGuidelinesTextarea.value = customGuidelines;
    }
    
    // Set up event listeners
    setupEventListeners();
    
    // Prepare tabs UI
    setupTabsUi();

    // Generate initial code
    await generateCode();
}

function setupTabsUi() {
    const codeContainer = document.querySelector('.code-container') as HTMLElement;
    if (!codeContainer) return;

    // Create tabs header
    const tabsHeader = document.createElement('div');
    tabsHeader.className = 'tabs-header';
    tabsHeader.innerHTML = `
        <button class="tab-btn active" data-tab="pom">POM</button>
        <button class="tab-btn" data-tab="data">Data</button>
    `;

    // Create two code panes
    const pomPane = document.createElement('pre');
    pomPane.className = 'code-content';
    pomPane.style.display = 'block';
    pomPane.innerHTML = `<code class="language-java"></code>`;

    const dataPane = document.createElement('pre');
    dataPane.className = 'code-content';
    dataPane.style.display = 'none';
    dataPane.innerHTML = `<code class="language-java"></code>`;

    pomPreEl = pomPane.querySelector('code');
    dataPreEl = dataPane.querySelector('code');

    // Replace existing codeContent with tabs
    const oldPre = document.getElementById('codeContent');
    if (oldPre) oldPre.remove();

    const loadingEl = document.getElementById('codeLoading');
    codeContainer.insertBefore(tabsHeader, loadingEl?.nextSibling || null);
    codeContainer.appendChild(pomPane);
    codeContainer.appendChild(dataPane);

    // Tab switching
    tabsHeader.addEventListener('click', (e) => {
        const btn = (e.target as HTMLElement).closest('.tab-btn') as HTMLButtonElement;
        if (!btn) return;
        const tab = btn.getAttribute('data-tab') as 'pom' | 'data';
        if (!tab) return;
        activeTab = tab;
        tabsHeader.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        pomPane.style.display = tab === 'pom' ? 'block' : 'none';
        dataPane.style.display = tab === 'data' ? 'block' : 'none';
    });
}

async function loadElements() {
    const { elements: storedElements } = await chrome.storage.local.get('elements');
    if (storedElements && storedElements[currentUrl]) {
        elements = storedElements[currentUrl];
        renderElements();
    }
}

function renderElements() {
    if (!elementsListElement) return;
    
    // Update element count
    if (elementCountElement) {
        elementCountElement.textContent = elements.length.toString();
    }
    
    // Clear existing elements
    elementsListElement.innerHTML = '';
    
    if (elements.length === 0) {
        // Show empty state
        elementsListElement.innerHTML = `
            <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" opacity="0.3">
                    <path d="M13 16H12V12H11M12 8H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <p>No elements captured yet</p>
                <p class="text-muted">Go back and capture some elements first</p>
            </div>
        `;
        return;
    }
    
    // Render each element
    elements.forEach((element, index) => {
        const elementItem = createElementItem(element, index);
        elementsListElement.appendChild(elementItem);
    });
}

function createElementItem(element: CapturedElement, index: number): HTMLElement {
    const elementDiv = document.createElement('div');
    elementDiv.className = 'element-item';
    
    const hasInput = !!element.input;
    const inputBadge = hasInput ? `<span class="badge" title="Input captured">Input</span>` : '';
    const inputEditor = hasInput
        ? `<div class="input-editor">
                <label>Value</label>
                <input type="text" class="element-input-value" value="${Array.isArray(element.input!.value) ? element.input!.value.join(',') : String(element.input!.value)}" data-index="${index}" />
                <span class="input-meta">${element.input!.type}${element.input!.placeholder ? ` • ${element.input!.placeholder}` : ''}${element.input!.labelText ? ` • ${element.input!.labelText}` : ''}</span>
           </div>`
        : '';

    elementDiv.innerHTML = `
        <div class="element-header">
            <span class="element-number">${index + 1}</span>
            <input type="text" class="element-name-input" value="${element.name}" placeholder="Element name" data-index="${index}" data-field="name">
            ${inputBadge}
            <button class="element-delete" data-index="${index}" title="Delete element">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M3 6H5H21M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
        </div>
        <input type="text" class="element-selector-input" value="${element.selector}" placeholder="CSS selector or XPath" data-index="${index}" data-field="selector">
        ${inputEditor}
    `;
    
    // Add event listeners
    const nameInput = elementDiv.querySelector('.element-name-input') as HTMLInputElement;
    const selectorInput = elementDiv.querySelector('.element-selector-input') as HTMLInputElement;
    const deleteButton = elementDiv.querySelector('.element-delete') as HTMLButtonElement;
    const inputValueInput = elementDiv.querySelector('.element-input-value') as HTMLInputElement | null;
    
    nameInput.addEventListener('input', handleElementUpdate);
    selectorInput.addEventListener('input', handleElementUpdate);
    deleteButton.addEventListener('click', handleElementDelete);
    
    if (inputValueInput) {
        inputValueInput.addEventListener('input', (e) => {
            const value = (e.target as HTMLInputElement).value;
            if (!elements[index].input) return;
            const inputType = elements[index].input!.type;
            if (inputType === 'select-multiple') {
                elements[index].input!.value = value.split(',').map(v => v.trim());
            } else if (inputType === 'checkbox' || inputType === 'radio') {
                elements[index].input!.value = value.toLowerCase() === 'true';
            } else {
                elements[index].input!.value = value;
            }
            saveElements();
        });
    }
    
    return elementDiv;
}

function handleElementUpdate(event: Event) {
    const input = event.target as HTMLInputElement;
    const index = parseInt(input.getAttribute('data-index')!);
    const field = input.getAttribute('data-field') as 'name' | 'selector';
    
    if (elements[index]) {
        elements[index][field] = input.value;
        saveElements();
    }
}

function handleElementDelete(event: Event) {
    const button = event.currentTarget as HTMLButtonElement;
    const index = parseInt(button.getAttribute('data-index')!);
    
    elements.splice(index, 1);
    saveElements();
    renderElements();
}

async function saveElements() {
    const { elements: storedElements } = await chrome.storage.local.get('elements');
    const allElements = storedElements || {};
    allElements[currentUrl] = elements;
    await chrome.storage.local.set({ elements: allElements });
}

function setupEventListeners() {
    // Regenerate code button
    regenerateCodeButton?.addEventListener('click', async () => {
        await generateCode();
        // Clear the custom prompt input after regenerating
        if (customPromptInput) {
            customPromptInput.value = '';
        }
    });
    
    // Add element button
    addElementButton?.addEventListener('click', () => {
        const newElement: CapturedElement = {
            name: `element${elements.length + 1}`,
            selector: '',
            tagName: 'div',
            attributes: {},
            textContent: ''
        };
        elements.push(newElement);
        saveElements();
        renderElements();
        
        // Focus on the new element's name input
        setTimeout(() => {
            const inputs = elementsListElement.querySelectorAll('.element-name-input');
            const lastInput = inputs[inputs.length - 1] as HTMLInputElement;
            lastInput?.focus();
            lastInput?.select();
        }, 100);
    });
    
    // Guidelines collapse/expand
    const guidelinesHeader = document.querySelector('.guidelines-header') as HTMLElement;
    const guidelinesSection = document.querySelector('.guidelines-section') as HTMLElement;
    
    if (guidelinesHeader && guidelinesSection) {
        // Load collapsed state from storage, default to collapsed
        chrome.storage.local.get('guidelinesCollapsed', (result) => {
            // Default to collapsed if no saved state exists
            const shouldCollapse = result.guidelinesCollapsed !== false;
            if (shouldCollapse) {
                guidelinesSection.classList.add('collapsed');
            }
        });
        
        // Add click handler
        guidelinesHeader.addEventListener('click', () => {
            const isCollapsed = guidelinesSection.classList.toggle('collapsed');
            // Save collapsed state
            chrome.storage.local.set({ guidelinesCollapsed: isCollapsed });
        });
    }
    
    // Copy code button
    copyCodeButton?.addEventListener('click', async () => {
        const code = activeTab === 'pom' ? (pomCode || '') : (dataCode || '');
        try {
            await navigator.clipboard.writeText(code);
            copyCodeButton.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            `;
            setTimeout(() => {
                copyCodeButton.innerHTML = `
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" stroke-width="2"/>
                        <path d="M5 15H4C2.89543 15 2 14.1046 2 13V4C2 2.89543 2.89543 2 4 2H13C14.1046 2 15 2.89543 15 4V5" stroke="currentColor" stroke-width="2"/>
                    </svg>
                `;
            }, 2000);
        } catch (err) {
            console.error('Failed to copy code:', err);
        }
    });
    
    // Download code button
    downloadCodeButton?.addEventListener('click', () => {
        const code = activeTab === 'pom' ? (pomCode || '') : (dataCode || '');
        const filename = activeTab === 'pom' ? (pomFileName ?? defaultFileName('pom')) : (dataFileName ?? defaultFileName('data'));
        const blob = new Blob([code], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    });
    
    // Custom guidelines auto-save
    let guidelinesSaveTimeout: number;
    customGuidelinesTextarea?.addEventListener('input', () => {
        clearTimeout(guidelinesSaveTimeout);
        guidelinesSaveTimeout = window.setTimeout(async () => {
            await chrome.storage.local.set({ customGuidelines: customGuidelinesTextarea.value });
        }, 1000);
    });
}

function defaultFileName(kind: 'pom' | 'data'): string {
    const pageName = currentUrl.split('/').pop()?.split('.')[0] || 'MyPage';
    const ext = guessExtensionForCode(activeTab === 'pom' ? (pomCode || '') : (dataCode || ''));
    return `${toPascalCase(pageName)}${kind === 'pom' ? 'Page' : 'Data'}.${ext}`;
}

function guessExtensionForCode(code: string): string {
    if (code.includes('class ') && code.includes('WebDriver')) return 'java';
    if (code.includes('import { Page }') || code.includes(': Page')) return 'ts';
    if (code.includes('module.exports') || code.includes('exports.')) return 'js';
    // Fallback default to java
    return 'java';
}

async function generateCode() {
    if (elements.length === 0) {
        updateCodeDisplays('// No elements to generate code for', '// No elements to generate code for');
        return;
    }
    
    // Show loading state
    codeLoadingElement.classList.add('active');
    (pomPreEl?.parentElement as HTMLElement).style.display = 'none';
    (dataPreEl?.parentElement as HTMLElement).style.display = 'none';
    
    regenerateCodeButton.disabled = true;
    regenerateCodeButton.textContent = 'Generating...';
    
    const pageName = currentUrl.split('/').pop()?.split('.')[0] || 'MyPage';
    const customGuidelines = customGuidelinesTextarea?.value || undefined;
    const customPrompt = customPromptInput?.value || undefined;
    
    try {
        // Send message to background script
        chrome.runtime.sendMessage({
            type: 'GENERATE_POM',
            payload: {
                elements: elements,
                language: 'Java' as Language,
                pageName: toPascalCase(pageName),
                customGuidelines: customGuidelines,
                customPrompt: customPrompt,
            },
        }, (response) => {
            if (response.error) {
                updateCodeDisplays(`// Error: ${response.error}`, `// Error: ${response.error}`);
            } else if (response.pomCode && response.dataCode) {
                pomCode = response.pomCode;
                dataCode = response.dataCode;
                pomFileName = response.pomFileName;
                dataFileName = response.dataFileName;
                updateCodeDisplays(pomCode || '', dataCode || '');
            } else if (response.code) {
                // fallback single blob
                pomCode = response.code;
                dataCode = '';
                updateCodeDisplays(pomCode || '', dataCode || '');
            } else {
                updateCodeDisplays('// No code returned', '// No code returned');
            }
            
            // Hide loading state
            codeLoadingElement.classList.remove('active');
            (pomPreEl?.parentElement as HTMLElement).style.display = activeTab === 'pom' ? 'block' : 'none';
            (dataPreEl?.parentElement as HTMLElement).style.display = activeTab === 'data' ? 'block' : 'none';
            
            regenerateCodeButton.disabled = false;
            regenerateCodeButton.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M13 2L3 14L12 13L11 22L21 10L12 11L13 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                Regenerate Code
            `;
        });
    } catch (error) {
        updateCodeDisplays(`// Error: ${error}`, `// Error: ${error}`);
        codeLoadingElement.classList.remove('active');
        (pomPreEl?.parentElement as HTMLElement).style.display = 'block';
        regenerateCodeButton.disabled = false;
        regenerateCodeButton.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M13 2L3 14L12 13L11 22L21 10L12 11L13 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Regenerate Code
        `;
    }
}

function normalizeCode(code: string): string {
    if (!code) return '';
    let s = code.replace(/\r\n/g, '\n');
    if (!/\n/.test(s)) {
        // Heuristics to expand single-line code into multiple lines
        s = s
            .replace(/;\s*import\s+/g, ';\nimport ')
            .replace(/\s*}\s*(public|private|protected|class|interface|export|async|function)/g, '}\n$1')
            .replace(/;\s*(public|private|protected|class|interface|export|async|function)/g, ';\n$1')
            .replace(/\)\s*\{/g, ') {\n')
            .replace(/\{\s*/g, '{\n')
            .replace(/\s*\}/g, '\n}')
            .replace(/\n{3,}/g, '\n\n');
    }
    return s;
}

function updateCodeDisplays(pom: string, data: string) {
    const pomText = normalizeCode(pom || '');
    const dataText = normalizeCode(data || '');
    if (pomPreEl) {
        pomPreEl.textContent = pomText;
        pomPreEl.className = detectLanguageClass(pomText || '');
        if (window.Prism) window.Prism.highlightElement(pomPreEl);
    }
    if (dataPreEl) {
        dataPreEl.textContent = dataText;
        dataPreEl.className = detectLanguageClass(dataText || '');
        if (window.Prism) window.Prism.highlightElement(dataPreEl);
    }
}

function detectLanguageClass(code: string): string {
    if (!code) return 'language-java';
    if (code.includes('class ') && code.includes('WebDriver')) return 'language-java';
    if (code.includes('import { Page }') || code.includes(': Page')) return 'language-typescript';
    if (code.includes('function ') || code.includes('const ') || code.includes('let ')) {
        if (code.includes('interface ') || code.includes(': string') || code.includes(': number') || code.includes('Promise<')) {
            return 'language-typescript';
        }
        return 'language-javascript';
    }
    return 'language-java';
}

function toPascalCase(str: string): string {
    return str.replace(/(^\w|-\w)/g, clearAndUpper).replace(/-/g, '');
}

function clearAndUpper(text: string): string {
    return text.replace(/-/, "").toUpperCase();
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeEditor); 