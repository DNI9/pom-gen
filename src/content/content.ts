let overlay: HTMLDivElement | null = null;

function createOverlay() {
    overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.zIndex = '999999';
    overlay.style.pointerEvents = 'none';
    document.body.appendChild(overlay);
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

function clickListener(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    const element = event.target as HTMLElement;

    // Use a robust selector, prefering CSS selector but falling back to XPath
    const selector = getCssSelector(element) || getXPath(element);
    
    if (selector) {
        chrome.storage.local.get('elements', (data) => {
            const elements = data.elements || {};
            const url = window.location.href;
            if (!elements[url]) {
                elements[url] = [];
            }
            const newElement = {
                name: `element${elements[url].length + 1}`,
                selector: selector,
            };
            elements[url].push(newElement);
            chrome.storage.local.set({ elements });
        });
    }

    element.style.outline = '';
}

function mouseoverListener(event: MouseEvent) {
    (event.target as HTMLElement).style.outline = '2px solid red';
}

function mouseoutListener(event: MouseEvent) {
    (event.target as HTMLElement).style.outline = '';
}

function startCapturing() {
    createOverlay();
    document.addEventListener('click', clickListener, true);
    document.addEventListener('mouseover', mouseoverListener);
    document.addEventListener('mouseout', mouseoutListener);
}

function stopCapturing() {
    if (overlay) {
        overlay.remove();
        overlay = null;
    }
    document.removeEventListener('click', clickListener, true);
    document.removeEventListener('mouseover', mouseoverListener);
    document.removeEventListener('mouseout', mouseoutListener);
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