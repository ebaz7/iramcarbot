import fs from 'fs';

let content = fs.readFileSync('bot_final.py', 'utf8');

// Replace TOKEN placeholder
content = content.replace(/TOKEN\s*=\s*'REPLACE_ME_TOKEN'/g, "TOKEN = 'REPLACE_ME_BALE_TOKEN'");

// Add Bale base_url to ApplicationBuilder
content = content.replace(
  /app\s*=\s*ApplicationBuilder\(\)\.token\(TOKEN\)\.post_init\(post_init\)\.build\(\)/g,
  'app = ApplicationBuilder().token(TOKEN).base_url("https://tapi.bale.ai/bot").post_init(post_init).build()'
);

if (!content.includes('https://tapi.bale.ai/bot')) {
    content = content.replace(
      /app\s*=\s*ApplicationBuilder\(\)\.token\((.*?)\)\.post_init\(post_init\)\.build\(\)/g,
      'app = ApplicationBuilder().token($1).base_url("https://tapi.bale.ai/bot").post_init(post_init).build()'
    );
}

fs.writeFileSync('bot_final_bale.py', content, 'utf8');
console.log('✅ Created bot_final_bale.py successfully');
