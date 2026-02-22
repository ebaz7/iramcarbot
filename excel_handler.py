import pandas as pd
import io
import logging
from database_manager import db

logger = logging.getLogger(__name__)

async def process_excel_update(file_bytes, niche):
    """
    Processes an Excel file to update prices.
    niche: 'cars' or 'mobile'
    """
    try:
        df = pd.read_excel(io.BytesIO(file_bytes))
        data = db.load_data()
        
        if niche == 'cars':
            # Expected columns: Brand, Model, Variant, MarketPrice, FactoryPrice
            for _, row in df.iterrows():
                brand = str(row['Brand'])
                model = str(row['Model'])
                variant = str(row['Variant'])
                m_price = float(row['MarketPrice'])
                f_price = float(row['FactoryPrice'])
                
                if brand not in data['car_db']:
                    data['car_db'][brand] = {"models": []}
                
                # Find or create model
                model_found = False
                for m in data['car_db'][brand]['models']:
                    if m['name'] == model:
                        model_found = True
                        # Find or create variant
                        variant_found = False
                        for v in m['variants']:
                            if v['name'] == variant:
                                v['marketPrice'] = m_price
                                v['factoryPrice'] = f_price
                                variant_found = True
                                break
                        if not variant_found:
                            m['variants'].append({"name": variant, "marketPrice": m_price, "factoryPrice": f_price})
                        break
                
                if not model_found:
                    data['car_db'][brand]['models'].append({
                        "name": model,
                        "variants": [{"name": variant, "marketPrice": m_price, "factoryPrice": f_price}]
                    })
                    
        elif niche == 'mobile':
            # Expected columns: Brand, Model, Storage, Price
            for _, row in df.iterrows():
                brand = str(row['Brand'])
                model = str(row['Model'])
                storage = str(row['Storage'])
                price = float(row['Price'])
                
                if brand not in data['mobile_db']:
                    data['mobile_db'][brand] = {"models": []}
                
                model_found = False
                for m in data['mobile_db'][brand]['models']:
                    if m['name'] == model:
                        m['price'] = price
                        m['storage'] = storage
                        model_found = True
                        break
                
                if not model_found:
                    data['mobile_db'][brand]['models'].append({
                        "name": model,
                        "price": price,
                        "storage": storage
                    })
        
        db.save_data(data)
        return True, "بروزرسانی با موفقیت انجام شد."
    except Exception as e:
        logger.error(f"Excel processing error: {e}")
        return False, f"خطا در پردازش فایل: {str(e)}"
