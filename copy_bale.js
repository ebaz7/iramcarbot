import fs from 'fs';

let content = fs.readFileSync('bot.py', 'utf8');

// Replace TOKEN placeholder
content = content.replace(/TOKEN\s*=\s*'REPLACE_ME_TOKEN'/g, "TOKEN = 'REPLACE_ME_BALE_TOKEN'");

// Add Bale base_url to ApplicationBuilder
content = content.replace(
  /app\s*=\s*ApplicationBuilder\(\)\.token\(TOKEN\)\.post_init\(post_init\)\.build\(\)/g,
  'app = ApplicationBuilder().token(TOKEN).base_url("https://tapi.bale.ai/bot").post_init(post_init).build()'
);

// If the user already changed the token, do a generic replace for ApplicationBuilder:
if (!content.includes('https://tapi.bale.ai/bot')) {
    content = content.replace(
      /app\s*=\s*ApplicationBuilder\(\)\.token\((.*?)\)\.post_init\(post_init\)\.build\(\)/g,
      'app = ApplicationBuilder().token($1).base_url("https://tapi.bale.ai/bot").post_init(post_init).build()'
    );
}

// Ensure the DATA_FILE is unique so they don't overwrite each other's configurations simultaneously if that's an issue,
// wait, the user said "without the slightest change". "دقیقا همین بات .. بدون کوچکترین تغییری".
// If I change data_file, they might not share data. If they share data, there might be race conditions, 
// but let's keep it exact as requested, or maybe use bot_bale_data.json? 
// "همین بات کار کنه" -> maybe they DO want the same data file so admins can manage both from one place! 
// Let's use the exact same DATA_FILE.

fs.writeFileSync('bot_bale.py', content, 'utf8');
console.log('✅ Created bot_bale.py successfully');
