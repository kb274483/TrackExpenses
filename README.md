# 這是一個記帳用的App
### [Notion 紀錄](https://delirious-workshop-239.notion.site/PWA-112993c5059a80f79ac1e947b53359eb?pvs=4)

目前是透過firebase的 Hosting服務做後端部署，
另外也有使用到Authentication以及Realtime Database

透過google登入的方式建立帳號，並可以選擇創立群組或是加入現有的群組。
進入群組後目前有五個主要功能
* 消費紀錄（以月為基準逐項紀錄每筆消費）
* 消費分佈（以圖表與表格方式顯示該月份各類別消費金額）
* 債務結算（計算該群組內所有人互相的債務關係）
* 群組管理 ~~（群組創建人可以自行決定是否將其餘成員踢出）~~ 
  考慮到消費資料與債務結算的關係，暫時先將踢出成員的功能關閉。
* 群組設定（目前可以新增每月固定開銷設定，每天00:00排程取得群組內是否有固定開銷的資料，並將資料添加至消費紀錄中）

也許未來還會新增其他功能

### 新增功能
因為有人向我提議他想要看特定的項目每個月的消費總計，所以我在群組設定的部分增加了自訂消費類別的功能。
主要就是在群組的資料中新增消費類別，可以自訂名稱與圖示，並透過firebase的服務產生一個隨機ID，
在消費分析或消費紀錄時將自訂的類別與預設消費類別合併。

### 2025/08 新增功能
因為前陣子剛出國回來，在國外使用這個網頁跟朋友做記帳、分帳，發現有些地方可以改進讓他用起來更方便。

### 虛擬帳號
所以我新增了虛擬人物的功能，這樣就算用戶不想登入我也可以把他加入群組並計算分帳，
### 換幣轉換
另一個就是貨幣的部分，我是想說記錄每一筆帳的貨幣最後在結算時應該會很麻煩，
再加上大多數時候貨幣不會一直變來變去，所以我改成在結算頁面時統一轉換，
只要記帳的時候統一貨幣那就不會有問題了。


# accounting app (accounting-pwa)
A Accounting App

## Install the dependencies
```bash
yarn
# or
npm install
```

### Start the app in development mode (hot-code reloading, error reporting, etc.)
```bash
quasar dev
```


### Lint the files
```bash
yarn lint
# or
npm run lint
```



### Build the app for production
```bash
quasar build
```

### Customize the configuration
See [Configuring quasar.config.js](https://v2.quasar.dev/quasar-cli-vite/quasar-config-js).
