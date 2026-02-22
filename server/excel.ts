import xlsx from 'xlsx';
import { updateSettings } from './settings';

export function parseExcelFile(filePath: string) {
  try {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    // Validate data structure (basic check)
    if (!data || data.length === 0) {
      throw new Error('Excel file is empty or invalid.');
    }

    // Store in settings
    updateSettings({ excelData: data });
    return data;
  } catch (error) {
    console.error('Error parsing Excel file:', error);
    throw error;
  }
}
