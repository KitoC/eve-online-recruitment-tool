// Client-side CSV parser

/**
 * Parse CSV text into JSON format
 */
export const parseCSV = (csvText) => {
  // Normalize line endings and split
  const normalizedText = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalizedText.split('\n').filter(line => line.trim() !== '');
  
  if (lines.length === 0) {
    return { headers: [], data: [] };
  }

  // Parse headers
  const headers = parseCSVLine(lines[0]).map(h => h.trim());

  if (headers.length === 0) {
    return { headers: [], data: [] };
  }

  // Parse data rows
  const data = lines.slice(1)
    .filter(line => line.trim() !== '') // Skip empty lines
    .map((line) => {
      const values = parseCSVLine(line);
      const row = {};
      headers.forEach((header, idx) => {
        row[header] = (values[idx] || '').trim();
      });
      return row;
    })
    .filter(row => Object.values(row).some(val => val !== '')); // Remove completely empty rows

  return { headers, data };
};

/**
 * Parse a single CSV line, handling quoted fields
 */
const parseCSVLine = (line) => {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  // Add last field
  result.push(current.trim());

  return result;
};

/**
 * Read file as text
 */
export const readFileAsText = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
};

