const axios = require('axios');
const xml2js = require('xml2js');
const https = require('https');

const CONFIG = {
  sitemapUrl: 'https://wwr650.github.io/blog/sitemap.xml',
  host: 'wwr650.github.io/blog',
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
  
  const keyValid = await verifyKeyFile();
  if (!keyValid) {
    process.exit(1);
  }

  const urls = await extractUrlsFromSitemap();
  if (urls.length === 0) {
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