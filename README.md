# 拾光撷语（DAYLIGHT）分发仓库

本仓库托管微信小程序「拾光撷语 / daylight」的每日卡片内容与预置字体，供客户端匿名拉取。

## 目录结构

content/
  manifest.json          内容清单（版本号 + 月份文件索引）
  months/                按月分文件（文件名含版本哈希；新增为增文件，历史版本保留）
fonts/
  manifest.json          字体清单（版本、SHA-256、OFL 许可证全文）
  wenkai.font.json       拾光文楷（霞鹜文楷 TC 子集，OFL 1.1）
  xiaowei.font.json      拾光小薇（站酷小薇体子集，OFL 1.1）

## 客户端拉取地址

小程序通过 raw 地址匿名读取（HTTPS，只读，无凭据）：

- 内容: https://raw.githubusercontent.com/summerandwinter/wstore/main/content/manifest.json
- 字体: https://raw.githubusercontent.com/summerandwinter/wstore/main/fonts/manifest.json

raw 域名（raw.githubusercontent.com）需加入小程序后台的 request / downloadFile 合法域名。

## 许可

字体为 SIL Open Font License 1.1（许可证内嵌于字体清单与容器）。内容为古典诗词公版摘句循环排期（演示数据）。本仓库仅用于随应用分发的 OFL 字体与公开卡片内容，不放私密文件。

## 更新方式

由主项目 scripts/sync-content.mjs（SSH 推送）维护，勿手动改。
