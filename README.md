# 匕首心角色創建

一步一步回答問題，建立《匕首心》（Daggerheart）1 級角色，最後產生可列印、可複製的角色卡。

純靜態網站（HTML + CSS + JavaScript），不需要建置步驟。

## 本機預覽

```bash
python3 -m http.server 8000
# 開啟 http://localhost:8000
```

## 部署

- **GitHub Pages**：推上 GitHub → Settings → Pages → Source 選 `main` 分支根目錄。
- **Vercel**：匯入 repo，Framework Preset 選「Other」，不用設定 build 指令。

## 檔案

| 檔案 | 內容 |
| --- | --- |
| `index.html` | 頁面骨架 |
| `css/style.css` | 樣式 |
| `js/app.js` | 步驟流程、計算、角色卡 |
| `js/data.js` | 職業、子職業、種族、社群、1 級領域卡、位階 1 裝備（由 SRD 抽取） |
| `js/guide.js` | 角色指南的外觀選項與職業物品 |
| `tools/extract.py` | 從 OG-DHSRD 的 `index.html` 重新產生資料 |

### 重新產生資料

```bash
git clone --depth 1 https://github.com/sassttrpgtools/og-dhsrd.git /tmp/og-dhsrd
python3 tools/extract.py /tmp/og-dhsrd/index.html /tmp/data.json
# 再把 data.json 轉成 js/data.js（只保留 level 1 領域卡）
```

## 授權與來源

本站為非官方愛好者工具，與 Darrington Press 無關。規則文字取自
[Old Gus《匕首心》系統參考文件（繁體中文版，Sass 編譯）](https://sassttrpgtools.github.io/og-dhsrd/)，
依 [Darrington Press 社群遊戲授權條款（DPCGL）](https://www.darringtonpress.com/license) 使用。
Daggerheart © Critical Role, LLC.
