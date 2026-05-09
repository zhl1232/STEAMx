# SEO Follow-up

更新时间：2026-05-06

当前站点公开地址：

- `http://steamx.cc`
- `https://steamx.cc` 目前还未打通，不要先提交到搜索平台

当前已完成：

- Google Search Console 域名验证已开始
- 百度搜索资源平台验证文件已部署
- `robots.txt`、`sitemap.xml`、首页与核心公开页 metadata 已修正并上线

## 明天先做什么

先检查下面两个地址是否正常：

- `http://steamx.cc/robots.txt`
- `http://steamx.cc/sitemap.xml`

再检查百度验证文件是否可访问：

- `http://steamx.cc/baidu_verify_codeva-tQYR4t1xrB.html`

如果都正常，再分别去 Google 和百度完成验证。

## Google Search Console

### 验证通过后

1. 打开 Search Console
2. 进入对应资源
   - 如果验证的是 `Domain property`，继续用这个资源
   - 如果验证的是 `URL-prefix property`，确认资源是 `http://steamx.cc/`
3. 在 `Sitemaps` 中提交：
   - `http://steamx.cc/sitemap.xml`
4. 在 `URL Inspection` 中手动检查并请求收录下面这些页面：
   - `http://steamx.cc/`
   - `http://steamx.cc/explore`
   - `http://steamx.cc/community`
   - `http://steamx.cc/nature`
5. 再补 2 到 5 个高质量详情页：
   - 优先选项目详情页
   - 或者自然观察详情页 / 物种详情页

### 1 到 3 天后检查

- `Pages` / `Indexing` 里是否出现抓取与收录数据
- `Sitemaps` 是否读取成功
- `URL Inspection` 是否显示页面可被抓取

### 7 到 14 天后检查

- 先查是否收录，不要先看泛关键词排名
- 搜索：
  - `site:steamx.cc`
  - 直接搜完整 URL
  - 搜页面标题全称

## 百度搜索资源平台

### 验证通过后

1. 打开站点管理，确认站点是：
   - `http://steamx.cc`
2. 进入 `普通收录` 或 `资源提交`
3. 提交 sitemap：
   - `http://steamx.cc/sitemap.xml`
4. 再手动提交核心页面：
   - `http://steamx.cc/`
   - `http://steamx.cc/explore`
   - `http://steamx.cc/community`
   - `http://steamx.cc/nature`
5. 如果平台允许批量普通收录，可继续补几个详情页

### 1 到 3 天后检查

- sitemap 是否读取成功
- 抓取是否报错
- 是否提示 robots、访问异常或页面不可达

### 7 到 14 天后检查

- 先看是否开始收录
- 再看品牌词与长尾词
- 不要先用 `steam` 单词判断效果，这个词竞争和歧义都太强

## 推荐先盯的搜索词

先看长尾和品牌组合词，不要先看大词：

- `steamx`
- `steamx.cc`
- `STEAM 探索`
- `STEAM 项目式学习`
- `自然观察`
- `鸟类观察`
- `项目式学习平台`
- 某个项目标题全称
- 某个物种名全称

## 现在不要做的事

- 不要把 `https://steamx.cc` 提交到 Google 或百度
- 不要在 HTTPS 没通的情况下把 canonical 改成 `https`
- 不要一次手动提交大量低质量页面
- 不要用首页去抢 `steam` 这种高竞争歧义词

## 下一个技术动作

SEO 之外，接下来最该做的是补 HTTPS：

1. 配置证书，让 `https://steamx.cc` 可访问
2. 做全站 `301`：`http://` -> `https://`
3. 把站点配置改成：
   - `NEXT_PUBLIC_APP_URL=https://steamx.cc`
4. 重新部署
5. 重新向 Google / 百度提交 `https://steamx.cc/sitemap.xml`

## 明天验证通过后可以继续让我做的事

- 检查 Google / 百度平台里的状态截图
- 挑一批最适合先提交收录的详情页
- 再补一轮更细的页面 SEO 文案
- 规划 HTTPS 切换步骤
