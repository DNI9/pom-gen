import { CapturedElement, Language } from '../shared/types';

let isCapturing = false;
let capturedElements: CapturedElement[] = [];
let currentTab: chrome.tabs.Tab;

// DOM Elements
const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
const saveApiKeyBtn = document.getElementById('saveApiKey') as HTMLButtonElement;
const toggleCaptureBtn = document.getElementById('toggleCapture') as HTMLButtonElement;
const elementsList = document.getElementById('elementsList') as HTMLUListElement;
const languageSelect = document.getElementById('languageSelect') as HTMLSelectElement;
const generatePomBtn = document.getElementById('generatePom') as HTMLButtonElement;
const outputCode = document.getElementById('outputCode') as HTMLElement;
const downloadCodeBtn = document.getElementById('downloadCode') as HTMLButtonElement;
const themeToggleBtn = document.getElementById('themeToggle') as HTMLButtonElement;
const captureStatus = document.getElementById('captureStatus') as HTMLElement;
const elementCount = document.getElementById('elementCount') as HTMLElement;
const outputCard = document.getElementById('outputCard') as HTMLElement;
const copyCodeBtn = document.getElementById('copyCode') as HTMLButtonElement;
const settingsBtn = document.getElementById('settingsBtn') as HTMLButtonElement;

// Get API key card element
const apiKeyCard = document.querySelector('.api-key-card') as HTMLElement;

// Initialize popup state
document.addEventListener('DOMContentLoaded', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTab = tab;

    // Load theme preference
    const { theme } = await chrome.storage.local.get('theme');
    if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
    }

    // Load API Key and handle visibility
    const { apiKey } = await chrome.storage.local.get('apiKey');
    if (apiKey) {
        // Hide API key card if key already exists
        apiKeyCard.style.display = 'none';
    } else {
        // Show API key card and focus on input
        apiKeyCard.style.display = 'block';
        apiKeyInput.focus();
    }

    // Load capturing state
    const { capturing } = await chrome.storage.local.get('capturing');
    isCapturing = capturing || false;
    updateCaptureUI();

    // Load elements for the current tab
    loadElementsForCurrentUrl();

    // Listen for storage changes to sync across extension parts
    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local' && changes.elements) {
            const { newValue } = changes.elements;
            if (newValue && newValue[currentTab.url!]) {
                capturedElements = newValue[currentTab.url!];
                renderElements();
            } else {
                capturedElements = [];
                renderElements();
            }
        }
    });
});

// Event Listeners
settingsBtn.addEventListener('click', async () => {
    // Toggle API key card visibility
    if (apiKeyCard.style.display === 'none') {
        apiKeyCard.style.display = 'block';
        
        // Load current API key if it exists
        const { apiKey } = await chrome.storage.local.get('apiKey');
        if (apiKey) {
            apiKeyInput.value = apiKey;
        }
        apiKeyInput.focus();
    } else {
        apiKeyCard.style.display = 'none';
    }
});

themeToggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    chrome.storage.local.set({ theme: newTheme });
});

saveApiKeyBtn.addEventListener('click', () => {
    const apiKeyValue = apiKeyInput.value.trim();
    
    // Only save if API key is not empty
    if (!apiKeyValue) {
        apiKeyInput.focus();
        return;
    }
    
    chrome.storage.local.set({ apiKey: apiKeyValue });
    
    // Show success feedback
    const originalContent = saveApiKeyBtn.innerHTML;
    saveApiKeyBtn.textContent = 'Saved!';
    saveApiKeyBtn.classList.add('api-key-saved');
    
    setTimeout(() => {
        // Hide the API key card after saving
        apiKeyCard.style.display = 'none';
        // Restore button content
        saveApiKeyBtn.innerHTML = originalContent;
        saveApiKeyBtn.classList.remove('api-key-saved');
    }, 1500);
});

toggleCaptureBtn.addEventListener('click', async () => {
    isCapturing = !isCapturing;
    await chrome.storage.local.set({ capturing: isCapturing });
    updateCaptureUI();
    
    if (isCapturing) {
        chrome.scripting.executeScript({
            target: { tabId: currentTab.id! },
            files: ['content.js'],
        });
    }
    window.close();
});

generatePomBtn.addEventListener('click', () => {
    const language = languageSelect.value as Language;
    const pageName = currentTab.url!.split('/').pop()?.split('.')[0] || 'MyPage';
    
    outputCode.textContent = 'Generating...';
    generatePomBtn.disabled = true;
    outputCard.style.display = 'block';

    chrome.runtime.sendMessage({
        type: 'GENERATE_POM',
        payload: {
            elements: capturedElements,
            language,
            pageName: toPascalCase(pageName),
        },
    }, (response) => {
        if (response.error) {
            outputCode.textContent = `Error: ${response.error}`;
        } else {
            outputCode.textContent = response.code;
            downloadCodeBtn.disabled = false;
        }
        generatePomBtn.disabled = false;
    });
});

copyCodeBtn.addEventListener('click', async () => {
    const code = outputCode.textContent || '';
    
    try {
        await navigator.clipboard.writeText(code);
        
        // Show success feedback
        copyCodeBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `;
        
        setTimeout(() => {
            copyCodeBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" stroke-width="2"/>
                    <path d="M5 15H4C2.89543 15 2 14.1046 2 13V4C2 2.89543 2.89543 2 4 2H13C14.1046 2 15 2.89543 15 4V5" stroke="currentColor" stroke-width="2"/>
                </svg>
            `;
        }, 2000);
    } catch (err) {
        console.error('Failed to copy code:', err);
    }
});

downloadCodeBtn.addEventListener('click', () => {
    const code = outputCode.textContent || '';
    const language = languageSelect.value as Language;
    const extension = {
        Java: 'java',
        JavaScript: 'js',
        TypeScript: 'ts',
    }[language];
    const pageName = currentTab.url!.split('/').pop()?.split('.')[0] || 'MyPage';

    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${toPascalCase(pageName)}Page.${extension}`;
    a.click();
    URL.revokeObjectURL(url);
});


// Functions
function updateCaptureUI() {
    const statusText = captureStatus.querySelector('.status-text') as HTMLElement;
    const captureButtonText = toggleCaptureBtn.querySelector('span') as HTMLElement;
    
    if (isCapturing) {
        document.body.classList.add('capturing');
        toggleCaptureBtn.classList.add('capturing');
        captureButtonText.textContent = 'Stop Capturing';
        statusText.textContent = 'Capturing elements...';
    } else {
        document.body.classList.remove('capturing');
        toggleCaptureBtn.classList.remove('capturing');
        captureButtonText.textContent = 'Start Capturing';
        statusText.textContent = 'Ready to capture';
    }
}

async function loadElementsForCurrentUrl() {
    if (!currentTab.url) return;
    const { elements } = await chrome.storage.local.get('elements');
    capturedElements = (elements && elements[currentTab.url]) ? elements[currentTab.url] : [];
    renderElements();
}

function renderElements() {
    // Update element count
    elementCount.textContent = capturedElements.length.toString();
    
    // Enable/disable generate button
    generatePomBtn.disabled = capturedElements.length === 0;
    
    elementsList.innerHTML = '';
    
    if (capturedElements.length === 0) {
        // Show empty state
        const emptyState = document.createElement('li');
        emptyState.className = 'empty-state';
        emptyState.innerHTML = `
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" opacity="0.3">
                <path d="M13 16H12V12H11M12 8H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <p>No elements captured yet</p>
            <p class="text-muted">Click "Start Capturing" and select elements on the page</p>
        `;
        elementsList.appendChild(emptyState);
        return;
    }
    
    capturedElements.forEach((el, index) => {
        const listItem = document.createElement('li');
        
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = el.name;
        nameInput.placeholder = 'Element Name';
        nameInput.addEventListener('change', (e) => {
            capturedElements[index].name = (e.target as HTMLInputElement).value;
            saveElements();
        });

        const selectorSpan = document.createElement('span');
        selectorSpan.className = 'selector';
        selectorSpan.textContent = el.selector;
        selectorSpan.title = el.selector;

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '×';
        deleteBtn.title = 'Remove element';
        deleteBtn.addEventListener('click', () => {
            capturedElements.splice(index, 1);
            saveElements();
            renderElements();
        });

        listItem.appendChild(nameInput);
        listItem.appendChild(selectorSpan);
        listItem.appendChild(deleteBtn);
        elementsList.appendChild(listItem);
    });
}

function saveElements() {
    chrome.storage.local.get('elements', (data) => {
        const allElements = data.elements || {};
        allElements[currentTab.url!] = capturedElements;
        chrome.storage.local.set({ elements: allElements });
    });
}

function toPascalCase(str: string): string {
    return str.replace(/(^\w|-\w)/g, clearAndUpper).replace(/-/g, '');
}

function clearAndUpper(text: string): string {
    return text.replace(/-/, "").toUpperCase();
} 