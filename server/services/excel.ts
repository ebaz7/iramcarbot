import * as XLSX from 'xlsx';
import { updatePrices, loadDB } from '../db';

export const parseExcel = (filePath: string) => {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    // Simple parsing logic (assuming columns: Brand, Model, Variant, MarketPrice, FactoryPrice)
    const cars: any = {};

    data.forEach((row: any) => {
      const brand = row['Brand'] || 'Unknown';
      const model = row['Model'] || 'Unknown';
      const variant = row['Variant'] || 'Base';
      const marketPrice = row['MarketPrice'] || 0;
      const factoryPrice = row['FactoryPrice'] || 0;

      if (!cars[brand]) cars[brand] = { models: [] };
      
      let modelObj = cars[brand].models.find((m: any) => m.name === model);
      if (!modelObj) {
        modelObj = { name: model, variants: [] };
        cars[brand].models.push(modelObj);
      }

      modelObj.variants.push({
        name: variant,
        marketPrice,
        factoryPrice,
      });
    });

    updatePrices({
      cars,
      source: 'Excel',
    });
    console.log('Prices updated from Excel successfully.');
    return cars;
  } catch (error) {
    console.error('Error parsing Excel:', error);
    throw error;
  }
};
