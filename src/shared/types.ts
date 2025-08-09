export interface CapturedElement {
  name: string;
  selector: string;
  tagName: string;
  attributes: Record<string, string>;
  textContent?: string;
}

export type Language = 'Java' | 'JavaScript' | 'TypeScript';

export interface GeneratePomRequest {
  type: 'GENERATE_POM';
  payload: {
    elements: CapturedElement[];
    language: Language;
    pageName: string;
    customGuidelines?: string; // Add support for custom guidelines
    customPrompt?: string; // Custom prompt to modify the generated code
  };
}

export interface UpdateElementsRequest {
    type: 'UPDATE_ELEMENTS';
    payload: {
        url: string;
        elements: CapturedElement[];
    };
}


export interface GetElementsRequest {
    type: 'GET_ELEMENTS';
    payload: {
        url: string;
    };
}

export type Message = GeneratePomRequest | UpdateElementsRequest | GetElementsRequest; 