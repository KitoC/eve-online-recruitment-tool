// API utility functions

const API_BASE = '';

/**
 * Make API request with authentication
 */
export const apiRequest = async (endpoint, options = {}) => {
  const tokens = JSON.parse(localStorage.getItem('eve_tokens') || 'null');
  const accessToken = tokens?.accessToken;

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (accessToken && options.includeAuth !== false) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
};

// CSV API
export const getCSVFiles = () => apiRequest('/api/csv-files');
export const getCSVPreview = (filename) => apiRequest(`/api/csv-preview/${filename}`);
export const getCSVVariables = (filename) => apiRequest(`/api/csv-variables/${filename}`);

// Template API
export const getTemplate = () => apiRequest('/api/template');
export const saveTemplate = (template) => apiRequest('/api/template', {
  method: 'POST',
  body: JSON.stringify(template),
});

// Email API
export const sendEmails = (csvData, template, tokens) => apiRequest('/api/send-emails', {
  method: 'POST',
  body: JSON.stringify({ csvData, template, tokens }),
});

export const getProgress = () => apiRequest('/api/progress');
export const pauseSending = () => apiRequest('/api/pause', { method: 'POST' });
export const resumeSending = () => apiRequest('/api/resume', { method: 'POST' });

// Member Extractor API
export const startMemberExtraction = (config) => apiRequest('/api/extract-members', {
  method: 'POST',
  body: JSON.stringify(config),
});

export const getExtractionProgress = () => apiRequest('/api/extraction-progress');

export const downloadExtraction = async () => {
  const response = await fetch('/api/download-extraction');
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  
  const blob = await response.blob();
  const contentDisposition = response.headers.get('Content-Disposition');
  let filename = 'extracted_members.csv';
  if (contentDisposition) {
    const filenameMatch = contentDisposition.match(/filename="(.+)"/);
    if (filenameMatch) {
      filename = filenameMatch[1];
    }
  }
  
  // Add filename to blob for convenience
  blob.filename = filename;
  return blob;
};

