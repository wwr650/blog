const axios = require('axios');
const xml2js = require('xml2js');
const https = require('https');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  siteUrl: 'https://wwr650.github.io/blog',
  sitemapUrl: 'https://wwr650.github.io/blog/sitemap.xml',
  host: 'wwr650.github.io',
  key: process.env.INDEXNOW_KEY || '6d179929c651445ba9847b00127de657',
  indexnowUrl: 'https://api.indexnow.org/IndexNow'
};

CONFIG.keyLocation = `https://${CONFIG.host}/blog/${CONFIG.key}.txt`;

async function verifyKeyFile() {
  console.log(`🔑 验证密钥文件: ${CONFIG.keyLocation}`);
  try {
    const response = await axios.get(CONFIG.keyLocation, { timeout: 10000 });
    if (response.status === 200) {
      console.log('✅ 密钥文件验证通过');
      return true;
    }
  } catch (error) {
    console.error(`❌ 密钥文件无法访问: ${error.message}`);
    return false;
  }
}

// 从文件名推导 Jekyll 文章 slug（规则：去掉日期前缀，非字母数字字符替换为 '-'）
function slugFromFilename(file) {
  const base = path.basename(file).replace(/\.(md|markdown)$/i, '');
  const title = base.replace(/^\d{4}-\d{1,2}-\d{1,2}-/, '');
  return title.replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '');
}

function buildCandidateUrl(file) {
  return `${CONFIG.siteUrl}/posts/${encodeURIComponent(slugFromFilename(file))}/`;
}

// 读取本次新增文章列表（--posts <file>，每行一个相对路径）
function loadNewPosts(args) {
  const idx = args.indexOf('--posts');
  if (idx === -1 || !args[idx + 1]) {
    return [];
  }
  try {
    return fs
      .readFileSync(args[idx + 1], 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  } catch (error) {
    console.error(`⚠️ 无法读取新增文章列表: ${error.message}`);
    return [];
  }
}

async function extractUrlsFromSitemap() {
  console.log(`📄 从站点地图提取URL: ${CONFIG.sitemapUrl}`);
  try {
    const response = await axios.get(CONFIG.sitemapUrl, { timeout: 10000 });
    const parser = new xml2js.Parser();
    
    const result = await parser.parseStringPromise(response.data);
    const urls = result.urlset.url.map(u => u.loc[0]);
    
    console.log(`✅ 成功提取 ${urls.length} 个URL`);
    console.log('前5个URL示例:', urls.slice(0, 5));
    return urls;
  } catch (error) {
    console.error(`❌ 解析站点地图失败: ${error.message}`);
    return [];
  }
}

async function submitBatch(urls) {
  const BATCH_SIZE = 10000;
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < urls.length; i += BATCH_SIZE) {
    const batch = urls.slice(i, i + BATCH_SIZE);
    console.log(`\n📤 提交第 ${Math.floor(i/BATCH_SIZE) + 1} 批 (${batch.length} 个URL)...`);

    try {
      const response = await axios.post(CONFIG.indexnowUrl, {
        host: CONFIG.host,
        key: CONFIG.key,
        keyLocation: CONFIG.keyLocation,
        urlList: batch
      }, {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Host': 'api.indexnow.org'
        },
        timeout: 30000
      });

      if (response.status === 200) {
        console.log(`✅ 第 ${Math.floor(i/BATCH_SIZE) + 1} 批提交成功`);
        successCount += batch.length;
      } else {
        console.log(`❌ 提交失败: ${response.status}`);
        failCount += batch.length;
      }
    } catch (error) {
      console.error(`❌ 提交出错: ${error.message}`);
      failCount += batch.length;
    }
  }

  return { success: successCount, fail: failCount };
}

async function main() {
  console.log('🚀 开始IndexNow URL提交任务');

  const newPosts = loadNewPosts(process.argv.slice(2));
  if (newPosts.length > 0) {
    console.log(`🆕 检测到 ${newPosts.length} 篇新文章，将同步提交其链接`);
  }

  const keyValid = await verifyKeyFile();
  if (!keyValid) {
    process.exit(1);
  }

  const urls = await extractUrlsFromSitemap();

  // 新文章若尚未收录到 sitemap（Pages 部署有滞后），则用推导 URL 兜底追加提交
  if (newPosts.length > 0) {
    const sitemapUrls = new Set(urls);
    for (const file of newPosts) {
      const candidate = buildCandidateUrl(file);
      if (sitemapUrls.has(candidate)) {
        console.log(`✅ 已在 sitemap 中: ${file} → ${candidate}`);
      } else {
        console.log(`➕ sitemap 未收录，追加提交: ${file} → ${candidate}`);
        urls.push(candidate);
      }
    }
  }

  if (urls.length === 0) {
    console.log('❌ 没有可提交的 URL');
    process.exit(1);
  }

  const results = await submitBatch(urls);
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 提交任务完成！');
  console.log(`总计处理: ${urls.length} 个URL`);
  console.log(`✅ 成功提交: ${results.success} 个`);
  console.log(`❌ 失败: ${results.fail} 个`);
  console.log('='.repeat(50));
}

main().catch(console.error);