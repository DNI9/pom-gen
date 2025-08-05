import { CapturedElement, Language } from '../shared/types';

let isCapturing = false;
let capturedElements: CapturedElement[] = [];
let currentTab: chrome.tabs.Tab;

const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
const saveApiKeyBtn = document.getElementById('saveApiKey') as HTMLButtonElement;
const toggleCaptureBtn = document.getElementById('toggleCapture') as HTMLButtonElement;
const elementsList = document.getElementById('elementsList') as HTMLUListElement;
const languageSelect = document.getElementById('languageSelect') as HTMLSelectElement;
const generatePomBtn = document.getElementById('generatePom') as HTMLButtonElement;
const outputCode = document.getElementById('outputCode') as HTMLElement;
const downloadCodeBtn = document.getElementById('downloadCode') as HTMLButtonElement;

// Initialize popup state
document.addEventListener('DOMContentLoaded', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTab = tab;

    // Load API Key
    const { apiKey } = await chrome.storage.local.get('apiKey');
    if (apiKey) {
        apiKeyInput.value = apiKey;
    }

    // Load capturing state
    const { capturing } = await chrome.storage.local.get('capturing');
    isCapturing = capturing;
    updateToggleButton();

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
saveApiKeyBtn.addEventListener('click', () => {
    chrome.storage.local.set({ apiKey: apiKeyInput.value });
    alert('API Key saved!');
});

toggleCaptureBtn.addEventListener('click', async () => {
    isCapturing = !isCapturing;
    await chrome.storage.local.set({ capturing: isCapturing });
    updateToggleButton();
    
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
function updateToggleButton() {
    if (isCapturing) {
        toggleCaptureBtn.textContent = 'Stop Capturing';
        toggleCaptureBtn.classList.add('capturing');
    } else {
        toggleCaptureBtn.textContent = 'Start Capturing';
        toggleCaptureBtn.classList.remove('capturing');
    }
}

async function loadElementsForCurrentUrl() {
    if (!currentTab.url) return;
    const { elements } = await chrome.storage.local.get('elements');
    capturedElements = (elements && elements[currentTab.url]) ? elements[currentTab.url] : [];
    renderElements();
}

function renderElements() {
    elementsList.innerHTML = '';
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
        deleteBtn.textContent = 'X';
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