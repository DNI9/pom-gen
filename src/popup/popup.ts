import { CapturedElement } from '../shared/types';

let isCapturing = false;
let capturedElements: CapturedElement[] = [];
let currentTab: chrome.tabs.Tab;

// DOM Elements
const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
const saveApiKeyBtn = document.getElementById('saveApiKey') as HTMLButtonElement;
const toggleCaptureBtn = document.getElementById('toggleCapture') as HTMLButtonElement;
const elementsList = document.getElementById('elementsList') as HTMLUListElement;
const generatePomBtn = document.getElementById('generatePom') as HTMLButtonElement;
const captureStatus = document.getElementById('captureStatus') as HTMLElement;
const elementCount = document.getElementById('elementCount') as HTMLElement;
const settingsBtn = document.getElementById('settingsBtn') as HTMLButtonElement;
const resetElementsBtn = document.getElementById('resetElements') as HTMLButtonElement;

// Custom guidelines elements
const customGuidelinesToggle = document.getElementById('customGuidelinesToggle') as HTMLButtonElement;
const customGuidelinesSection = document.getElementById('customGuidelinesSection') as HTMLElement;
const customGuidelinesTextarea = document.getElementById('customGuidelines') as HTMLTextAreaElement;
const saveGuidelinesBtn = document.getElementById('saveGuidelines') as HTMLButtonElement;

// Get API key card element
const apiKeyCard = document.querySelector('.api-key-card') as HTMLElement;

// Initialize popup state
document.addEventListener('DOMContentLoaded', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTab = tab;

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

    // Load custom guidelines
    const { customGuidelines } = await chrome.storage.local.get('customGuidelines');
    if (customGuidelines) {
        customGuidelinesTextarea.value = customGuidelines;
    }

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

resetElementsBtn.addEventListener('click', async () => {
    // Confirm before resetting
    if (capturedElements.length > 0) {
        const confirmReset = confirm(`Are you sure you want to reset all ${capturedElements.length} captured elements?`);
        if (!confirmReset) {
            return;
        }
    }
    
    // Clear captured elements
    capturedElements = [];
    
    // Update storage to remove elements for current URL
    chrome.storage.local.get('elements', (data) => {
        const allElements = data.elements || {};
        delete allElements[currentTab.url!];
        chrome.storage.local.set({ elements: allElements });
    });
    
    // Re-render the elements list
    renderElements();
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

generatePomBtn.addEventListener('click', async () => {
    // Stop capturing if active
    if (isCapturing) {
        isCapturing = false;
        await chrome.storage.local.set({ capturing: false });
        updateCaptureUI();
    }
    
    // Open editor in a new tab
    const editorUrl = chrome.runtime.getURL(`editor.html?url=${encodeURIComponent(currentTab.url!)}`);
    chrome.tabs.create({ url: editorUrl });
    
    // Close the popup
    window.close();
});



// Custom guidelines event listeners
customGuidelinesToggle.addEventListener('click', () => {
    const isVisible = customGuidelinesSection.style.display !== 'none';
    customGuidelinesSection.style.display = isVisible ? 'none' : 'block';
    
    if (!isVisible) {
        customGuidelinesTextarea.focus();
    }
});

saveGuidelinesBtn.addEventListener('click', async () => {
    const guidelines = customGuidelinesTextarea.value.trim();
    
    // Save to storage
    await chrome.storage.local.set({ customGuidelines: guidelines });
    
    // Show success feedback
    const originalText = saveGuidelinesBtn.textContent;
    saveGuidelinesBtn.textContent = 'Saved!';
    saveGuidelinesBtn.classList.add('api-key-saved');
    
    setTimeout(() => {
        saveGuidelinesBtn.textContent = originalText!;
        saveGuidelinesBtn.classList.remove('api-key-saved');
    }, 1500);
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