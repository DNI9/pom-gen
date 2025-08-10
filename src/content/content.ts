let overlay: HTMLDivElement | null = null;
let highlightElement: HTMLDivElement | null = null;
let tooltipElement: HTMLDivElement | null = null;
let currentElement: HTMLElement | null = null;
let captureStyleEl: HTMLStyleElement | null = null;
let activeInputEl: HTMLElement | null = null;

function createOverlay() {
    // Create main overlay container
    overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        z-index: 999999;
        pointer-events: none;
    `;
    
    // Create highlight element with modern design
    highlightElement = document.createElement('div');
    highlightElement.style.cssText = `
        position: absolute;
        pointer-events: none;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%);
        border: 2px solid transparent;
        border-image: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%) 1;
        border-radius: 8px;
        box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1), 
                    0 4px 12px rgba(99, 102, 241, 0.2),
                    inset 0 0 20px rgba(139, 92, 246, 0.05);
        opacity: 0;
        transform: scale(0.95);
    `;
    
    // Create tooltip element
    tooltipElement = document.createElement('div');
    tooltipElement.style.cssText = `
        position: absolute;
        pointer-events: none;
        background: rgba(17, 24, 39, 0.95);
        backdrop-filter: blur(12px);
        color: white;
        padding: 12px 16px;
        border-radius: 12px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 13px;
        line-height: 1.5;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3),
                    0 0 0 1px rgba(255, 255, 255, 0.1);
        opacity: 0;
        transform: translateY(10px) scale(0.95);
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        z-index: 1000000;
        max-width: 300px;
    `;
    
    overlay.appendChild(highlightElement);
    overlay.appendChild(tooltipElement);
    document.body.appendChild(overlay);

    // Persistent styles for active input capture
    if (!captureStyleEl) {
        captureStyleEl = document.createElement('style');
        captureStyleEl.textContent = `
            .__pomgen2-capture-focus__ {
                outline: 2px solid #22d3ee !important;
                outline-offset: 2px !important;
                transition: outline-color 0.2s ease;
            }
        `;
        document.head.appendChild(captureStyleEl);
    }
}

function updateHighlight(element: HTMLElement) {
    if (!highlightElement || !tooltipElement) return;
    
    const rect = element.getBoundingClientRect();
    
    // Update highlight position and size
    highlightElement.style.left = `${rect.left - 4}px`;
    highlightElement.style.top = `${rect.top - 4}px`;
    highlightElement.style.width = `${rect.width + 8}px`;
    highlightElement.style.height = `${rect.height + 8}px`;
    highlightElement.style.opacity = '1';
    highlightElement.style.transform = 'scale(1)';
    
    // Create tooltip content with element information
    const tagName = element.tagName.toLowerCase();
    const id = element.id ? `#${element.id}` : '';
    const classes = element.className ? `.${element.className.split(' ').filter(c => c).join('.')}` : '';
    const text = element.textContent?.trim().substring(0, 50) || '';
    
    tooltipElement.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <div style="width: 8px; height: 8px; background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%); border-radius: 50%;"></div>
            <span style="font-weight: 600; color: #E5E7EB;">${tagName}${id}${classes}</span>
        </div>
        ${text ? `<div style="color: #9CA3AF; font-size: 12px; margin-bottom: 4px;">"${text}..."</div>` : ''}
        <div style="display: flex; gap: 12px; margin-top: 8px;">
            <div style="display: flex; align-items: center; gap: 4px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366F1" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <line x1="9" y1="9" x2="15" y2="9" />
                    <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
                <span style="font-size: 11px; color: #A78BFA;">${Math.round(rect.width)}×${Math.round(rect.height)}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 4px;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" stroke-width="2">
                    <path d="M12 2L2 7L12 12L22 7L12 2Z" />
                    <path d="M2 17L12 22L22 17" />
                    <path d="M2 12L12 17L22 12" />
                </svg>
                <span style="font-size: 11px; color: #C4B5FD;">Click to capture</span>
            </div>
        </div>
    `;
    
    // Position tooltip
    const tooltipRect = tooltipElement.getBoundingClientRect();
    let tooltipLeft = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
    let tooltipTop = rect.top - tooltipRect.height - 12;
    
    // Adjust if tooltip goes off screen
    if (tooltipLeft < 10) tooltipLeft = 10;
    if (tooltipLeft + tooltipRect.width > window.innerWidth - 10) {
        tooltipLeft = window.innerWidth - tooltipRect.width - 10;
    }
    if (tooltipTop < 10) {
        tooltipTop = rect.bottom + 12;
    }
    
    tooltipElement.style.left = `${tooltipLeft}px`;
    tooltipElement.style.top = `${tooltipTop}px`;
    tooltipElement.style.opacity = '1';
    tooltipElement.style.transform = 'translateY(0) scale(1)';
}

function hideHighlight() {
    if (highlightElement) {
        highlightElement.style.opacity = '0';
        highlightElement.style.transform = 'scale(0.95)';
    }
    if (tooltipElement) {
        tooltipElement.style.opacity = '0';
        tooltipElement.style.transform = 'translateY(10px) scale(0.95)';
    }
}

function showSelectedAnimation(element: HTMLElement) {
    const rect = element.getBoundingClientRect();
    
    // Create a pulse animation element
    const pulseElement = document.createElement('div');
    pulseElement.style.cssText = `
        position: absolute;
        left: ${rect.left - 4}px;
        top: ${rect.top - 4}px;
        width: ${rect.width + 8}px;
        height: ${rect.height + 8}px;
        pointer-events: none;
        border: 2px solid #10B981;
        border-radius: 8px;
        background: rgba(16, 185, 129, 0.1);
        z-index: 999998;
        animation: pulseSuccess 0.4s ease-out;
    `;
    
    // Add animation keyframes
    const style = document.createElement('style');
    style.textContent = `
        @keyframes pulseSuccess {
            0% {
                transform: scale(1);
                opacity: 1;
                box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4);
            }
            100% {
                transform: scale(1.05);
                opacity: 0;
                box-shadow: 0 0 0 20px rgba(16, 185, 129, 0);
            }
        }
    `;
    document.head.appendChild(style);
    
    overlay?.appendChild(pulseElement);
    setTimeout(() => {
        pulseElement.remove();
        style.remove();
    }, 400);
}

function getCssSelector(el: Element): string {
    if (!(el instanceof Element)) return '';
    const path: string[] = [];
    while (el.nodeType === Node.ELEMENT_NODE) {
        let selector = el.nodeName.toLowerCase();
        if (el.id) {
            selector += '#' + el.id;
            path.unshift(selector);
            break;
        } else {
            let sib = el, nth = 1;
            while (sib.previousElementSibling) {
                sib = sib.previousElementSibling;
                if (sib.nodeName.toLowerCase() === selector) nth++;
            }
            if (nth !== 1) selector += `:nth-of-type(${nth})`;
        }
        path.unshift(selector);
        el = el.parentNode as Element;
    }
    return path.join(' > ');
}

function getXPath(element: HTMLElement): string {
    if (element.id !== '') {
        return `//*[@id="${element.id}"]`;
    }
    if (element === document.body) {
        return element.tagName.toLowerCase();
    }

    let ix = 0;
    const siblings = element.parentNode?.children || new HTMLCollection();
    for (let i = 0; i < siblings.length; i++) {
        const sibling = siblings[i];
        if (sibling === element) {
            return `${getXPath(element.parentNode as HTMLElement)}/${element.tagName.toLowerCase()}[${ix + 1}]`;
        }
        if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
            ix++;
        }
    }
    return '';
}

function toCamelCase(str: string): string {
    // Remove special characters and convert to camelCase
    return str
        .replace(/[^a-zA-Z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 0)
        .map((word, index) => {
            if (index === 0) {
                return word.toLowerCase();
            }
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join('');
}

function generateElementName(element: HTMLElement, existingNames: string[]): string {
    let baseName = '';
    const tagName = element.tagName.toLowerCase();
    
    // Priority 1: name attribute
    if (element.getAttribute('name')) {
        baseName = element.getAttribute('name')!;
    }
    // Priority 2: id attribute
    else if (element.id) {
        baseName = element.id;
    }
    // Priority 3: placeholder attribute (for inputs)
    else if (element.getAttribute('placeholder')) {
        baseName = element.getAttribute('placeholder')!;
    }
    // Priority 4: aria-label attribute
    else if (element.getAttribute('aria-label')) {
        baseName = element.getAttribute('aria-label')!;
    }
    // Priority 5: value attribute (for buttons and inputs)
    else if ((tagName === 'button' || tagName === 'input') && element.getAttribute('value')) {
        baseName = element.getAttribute('value')!;
    }
    // Priority 6: text content (for buttons, links, labels)
    else if ((tagName === 'button' || tagName === 'a' || tagName === 'label') && element.textContent) {
        baseName = element.textContent.trim().substring(0, 30);
    }
    // Priority 7: alt attribute (for images)
    else if (tagName === 'img' && element.getAttribute('alt')) {
        baseName = element.getAttribute('alt')!;
    }
    // Priority 8: type attribute for inputs
    else if (tagName === 'input' && element.getAttribute('type')) {
        const inputType = element.getAttribute('type')!;
        baseName = inputType + 'Input';
    }
    // Priority 9: Use tag name with specific prefixes
    else {
        const tagPrefixes: { [key: string]: string } = {
            'button': 'button',
            'input': 'input',
            'a': 'link',
            'img': 'image',
            'div': 'container',
            'span': 'text',
            'p': 'paragraph',
            'h1': 'heading',
            'h2': 'subheading',
            'h3': 'subheading',
            'ul': 'list',
            'li': 'listItem',
            'table': 'table',
            'form': 'form',
            'select': 'dropdown',
            'textarea': 'textArea'
        };
        baseName = tagPrefixes[tagName] || tagName;
    }
    
    // Convert to camelCase
    let elementName = toCamelCase(baseName);
    
    // Ensure the name starts with a letter
    if (!/^[a-zA-Z]/.test(elementName)) {
        elementName = tagName + elementName.charAt(0).toUpperCase() + elementName.slice(1);
    }
    
    // If empty, use tag name
    if (!elementName) {
        elementName = tagName;
    }
    
    // Ensure uniqueness by appending numbers if needed
    let finalName = elementName;
    let counter = 1;
    while (existingNames.includes(finalName)) {
        counter++;
        finalName = `${elementName}${counter}`;
    }
    
    return finalName;
}

function getElementAttributes(element: HTMLElement): Record<string, string> {
    const attributes: Record<string, string> = {};
    for (let i = 0; i < element.attributes.length; i++) {
        const attr = element.attributes[i];
        attributes[attr.name] = attr.value;
    }
    return attributes;
}

function isInputLike(el: HTMLElement): boolean {
    const tag = el.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
    if (el.hasAttribute('contenteditable')) return true;
    return false;
}

function getLabelTextFor(element: HTMLElement): string | undefined {
    // Try aria-label
    const aria = element.getAttribute('aria-label');
    if (aria) return aria;
    // Try <label for="id">
    if (element.id) {
        const label = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
        if (label) return (label.textContent || '').trim();
    }
    // Try wrapping label
    let parent: HTMLElement | null = element;
    while (parent && parent !== document.body) {
        if (parent.tagName.toLowerCase() === 'label') {
            return (parent.textContent || '').trim();
        }
        parent = parent.parentElement;
    }
    return undefined;
}

function readInputValue(element: HTMLElement): { type: string; value: string | string[] | boolean } {
    const tag = element.tagName.toLowerCase();
    if (tag === 'input') {
        const input = element as HTMLInputElement;
        const inputType = (input.type || 'text').toLowerCase();
        switch (inputType) {
            case 'checkbox':
                return { type: 'checkbox', value: input.checked };
            case 'radio':
                return { type: 'radio', value: input.checked };
            case 'number':
                return { type: 'number', value: input.value };
            case 'password':
                return { type: 'password', value: input.value };
            case 'email':
                return { type: 'email', value: input.value };
            case 'date':
                return { type: 'date', value: input.value };
            case 'time':
                return { type: 'time', value: input.value };
            case 'datetime-local':
                return { type: 'datetime-local', value: input.value };
            case 'tel':
                return { type: 'tel', value: input.value };
            case 'url':
                return { type: 'url', value: input.value };
            case 'color':
                return { type: 'color', value: input.value };
            case 'range':
                return { type: 'range', value: input.value };
            default:
                return { type: 'text', value: input.value };
        }
    }
    if (tag === 'textarea') {
        const ta = element as HTMLTextAreaElement;
        return { type: 'textarea', value: ta.value };
    }
    if (tag === 'select') {
        const sel = element as HTMLSelectElement;
        const values = Array.from(sel.selectedOptions).map((o) => o.value);
        return { type: sel.multiple ? 'select-multiple' : 'select-one', value: sel.multiple ? values : (values[0] || '') };
    }
    if (element.hasAttribute('contenteditable')) {
        return { type: 'contenteditable', value: (element.textContent || '').trim() };
    }
    return { type: 'text', value: '' };
}

function upsertCapturedElement(element: HTMLElement, selector: string, existing: any[]): { index: number } {
    const idx = existing.findIndex((el) => el.selector === selector);
    if (idx !== -1) {
        return { index: idx };
    }
    const existingNames = existing.map((el: any) => el.name);
    const elementName = generateElementName(element, existingNames);
    const newElement = {
        name: elementName,
        selector: selector,
        tagName: element.tagName.toLowerCase(),
        attributes: getElementAttributes(element),
        textContent: element.textContent?.trim().substring(0, 100),
    };
    existing.push(newElement);
    return { index: existing.length - 1 };
}

function startInputCapture(target: HTMLElement) {
    activeInputEl = target;
    target.classList.add('__pomgen2-capture-focus__');

    const selector = getCssSelector(target) || getXPath(target);
    if (!selector) return;

    chrome.storage.local.get('elements', (data) => {
        const elements = data.elements || {};
        const url = window.location.href;
        if (!elements[url]) elements[url] = [];

        const { index } = upsertCapturedElement(target, selector, elements[url]);
        // attach input meta immediately
        const { type, value } = readInputValue(target);
        const inputMeta = {
            type,
            value,
            nameAttr: target.getAttribute('name') || undefined,
            placeholder: target.getAttribute('placeholder') || undefined,
            labelText: getLabelTextFor(target),
        };
        elements[url][index].input = inputMeta;
        chrome.storage.local.set({ elements });
    });

    // Attach listeners to keep value up to date during typing
    const onInput = () => {
        if (!activeInputEl) return;
        const selector = getCssSelector(activeInputEl) || getXPath(activeInputEl);
        if (!selector) return;
        const { type, value } = readInputValue(activeInputEl);
        chrome.storage.local.get('elements', (data) => {
            const elements = data.elements || {};
            const url = window.location.href;
            if (!elements[url]) return;
            const idx = elements[url].findIndex((el: any) => el.selector === selector);
            if (idx !== -1) {
                elements[url][idx].input = {
                    ...(elements[url][idx].input || {}),
                    type,
                    value,
                    nameAttr: activeInputEl!.getAttribute('name') || undefined,
                    placeholder: activeInputEl!.getAttribute('placeholder') || undefined,
                    labelText: getLabelTextFor(activeInputEl!),
                };
                chrome.storage.local.set({ elements });
            }
        });
    };

    const onBlur = () => {
        if (!activeInputEl) return;
        showSelectedAnimation(activeInputEl);
        activeInputEl.classList.remove('__pomgen2-capture-focus__');
        activeInputEl.removeEventListener('input', onInput);
        activeInputEl.removeEventListener('change', onInput);
        activeInputEl.removeEventListener('blur', onBlur, true);
        activeInputEl = null;
    };

    target.addEventListener('input', onInput);
    target.addEventListener('change', onInput);
    target.addEventListener('blur', onBlur, true);
}

function clickListener(event: MouseEvent) {
    const element = event.target as HTMLElement;

    if (isInputLike(element)) {
        // Allow default focus/interaction; start capturing on focus if not already
        if (activeInputEl !== element) {
            startInputCapture(element);
        }
        return; // Do not block
    }

    // For non-inputs, capture and prevent default behavior
    event.preventDefault();
    event.stopPropagation();

    // Show selection animation
    showSelectedAnimation(element);

    const selector = getCssSelector(element) || getXPath(element);
    
    if (selector) {
        chrome.storage.local.get('elements', (data) => {
            const elements = data.elements || {};
            const url = window.location.href;
            if (!elements[url]) {
                elements[url] = [];
            }
            
            const existingNames = elements[url].map((el: any) => el.name);
            const elementName = generateElementName(element, existingNames);
            
            const newElement = {
                name: elementName,
                selector: selector,
                tagName: element.tagName.toLowerCase(),
                attributes: getElementAttributes(element),
                textContent: element.textContent?.trim().substring(0, 100)
            };
            elements[url].push(newElement);
            chrome.storage.local.set({ elements });
        });
    }
    
    hideHighlight();
}

function mouseoverListener(event: MouseEvent) {
    const element = event.target as HTMLElement;
    if (element !== currentElement) {
        currentElement = element;
        updateHighlight(element);
    }
}

function mouseoutListener(_event: MouseEvent) {
    currentElement = null;
    hideHighlight();
}

function focusinListener(event: FocusEvent) {
    const element = event.target as HTMLElement;
    if (!isInputLike(element)) return;
    if (activeInputEl === element) return;
    startInputCapture(element);
}

function startCapturing() {
    createOverlay();
    document.addEventListener('click', clickListener, true);
    document.addEventListener('mouseover', mouseoverListener);
    document.addEventListener('mouseout', mouseoutListener);
    document.addEventListener('focusin', focusinListener, true);
}

function stopCapturing() {
    if (overlay) {
        overlay.remove();
        overlay = null;
    }
    if (captureStyleEl) {
        captureStyleEl.remove();
        captureStyleEl = null;
    }
    highlightElement = null;
    tooltipElement = null;
    currentElement = null;
    activeInputEl = null;
    document.removeEventListener('click', clickListener, true);
    document.removeEventListener('mouseover', mouseoverListener);
    document.removeEventListener('mouseout', mouseoutListener);
    document.removeEventListener('focusin', focusinListener, true);
}

chrome.storage.local.get('capturing', ({ capturing }) => {
    if (capturing) {
        startCapturing();
    }
});

chrome.storage.onChanged.addListener((changes) => {
    if (changes.capturing) {
        if (changes.capturing.newValue) {
            startCapturing();
        } else {
            stopCapturing();
        }
    }
}); 