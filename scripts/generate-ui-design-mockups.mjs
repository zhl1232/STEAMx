import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { chromium } from "@playwright/test";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "docs", "ui-design-mockups");
const DIR = {
  assets: path.join(OUT, "assets"),
  htmlPc: path.join(OUT, "html", "pc"),
  htmlMobile: path.join(OUT, "html", "mobile"),
  pc: path.join(OUT, "pc"),
  mobile: path.join(OUT, "mobile"),
};

const DESKTOP = { width: 1440, height: 1080 };
const MOBILE = { width: 390, height: 1040 };

const asset = (name) => `assets/${name}`;
const htmlAsset = (name) => `../../assets/${name}`;

const pages = [
  ["01-home", 1, "首页", "/", "home", "探索"],
  ["02-explore", 2, "探索页", "/explore", "listing", "探索"],
  ["03-project-detail", 3, "项目详情页", "/project/[id]", "detail", "探索"],
  ["04-project-editor", 4, "项目发布页", "/project", "form", "探索"],
  ["05-community", 5, "社区首页", "/community", "community", "社区"],
  ["06-challenge-detail", 6, "挑战详情页", "/community/challenge/[id]", "challenge", "社区"],
  ["07-nature-home", 7, "自然观察首页", "/nature", "nature", "自然观察"],
  ["08-observation-submit", 8, "观察记录提交页", "/nature/submit", "form", "自然观察"],
  ["09-species-detail", 9, "物种详情页", "/nature/species/[slug]", "species", "自然观察"],
  ["10-profile", 10, "我的主页", "/profile", "profile", "我的"],
  ["11-login", 11, "登录注册页", "/login", "auth", "登录"],
  ["12-messages", 12, "消息中心页", "/messages", "messages", "我的"],
  ["13-discussion-detail", 13, "讨论详情页", "/community/discussion/[id]", "discussion", "社区"],
  ["14-challenge-submit", 14, "挑战作品提交页", "/community/challenge/[id]/submit", "form", "社区"],
  ["15-bird-topic", 15, "鸟类专题页", "/nature/birds", "nature-list", "自然观察"],
  ["16-observations-list", 16, "观察记录列表页", "/nature/observations", "nature-list", "自然观察"],
  ["17-observation-detail", 17, "观察记录详情页", "/nature/observations/[id]", "observation", "自然观察"],
  ["18-species-list", 18, "物种档案列表页", "/nature/species", "nature-list", "自然观察"],
  ["19-profile-library", 19, "内容库页", "/profile/library", "profile", "我的"],
  ["20-public-user", 20, "公开用户主页", "/users/[id]", "profile", "社区"],
  ["21-direct-message", 21, "私信会话页", "/messages/[userId]", "chat", "我的"],
  ["22-leaderboard", 22, "排行榜页", "/leaderboard", "leaderboard", "排行榜"],
  ["23-coins", 23, "钱包页", "/coins", "shop", "商店"],
  ["24-shop", 24, "商店页", "/shop", "shop", "商店"],
  ["25-settings", 25, "设置首页", "/settings", "settings", "我的"],
  ["26-profile-settings", 26, "个人资料设置页", "/settings/profile", "form", "我的"],
  ["27-security", 27, "账号与安全页", "/settings/security", "settings", "我的"],
  ["28-privacy", 28, "隐私设置页", "/settings/privacy", "settings", "我的"],
  ["29-notifications", 29, "通知设置页", "/settings/notifications", "settings", "我的"],
  ["30-appearance", 30, "外观设置页", "/settings/appearance", "settings", "我的"],
  ["31-about-help", 31, "关于与帮助页", "/settings/about", "settings", "我的"],
  ["32-admin", 32, "管理员控制台", "/admin", "admin", "后台"],
  ["33-moderator-apply", 33, "审核员申请页", "/moderator/apply", "form", "社区"],
  ["34-moderator-applications", 34, "审核员申请管理页", "/admin/moderator-applications", "admin", "后台"],
  ["35-playground", 35, "游乐场首页", "/playground", "playground", "游乐场"],
  ["36-playground-24game", 36, "24 点页面", "/playground/24game", "game", "游乐场"],
  ["37-playground-2048", 37, "2048 页面", "/playground/2048", "game", "游乐场"],
  ["38-playground-gomoku", 38, "五子棋页面", "/playground/gomoku", "game", "游乐场"],
  ["39-playground-hanoi", 39, "汉诺塔页面", "/playground/hanoi", "game", "游乐场"],
  ["40-playground-life", 40, "生命游戏页面", "/playground/life", "game", "游乐场"],
  ["41-playground-minesweeper", 41, "扫雷页面", "/playground/minesweeper", "game", "游乐场"],
  ["42-playground-minesweeper-course", 42, "扫雷课程页", "/playground/minesweeper/course", "game", "游乐场"],
  ["43-playground-nqueens", 43, "N 皇后页面", "/playground/nqueens", "game", "游乐场"],
  ["44-playground-sorting", 44, "排序可视化页", "/playground/sorting", "game", "游乐场"],
  ["45-playground-sudoku", 45, "数独页面", "/playground/sudoku", "game", "游乐场"],
].map(([id, prompt, title, route, kind, nav]) => ({ id, prompt, title, route, kind, nav }));

const navItems = [
  ["探索", "⊕"],
  ["社区", "▣"],
  ["自然观察", "◌"],
  ["游乐场", "⌁"],
];

const projectItems = [
  {
    title: "自制水火箭飞不高？来看看我做了哪些改进",
    desc: "经过多次测试，发现影响水火箭高度的关键因素有很多，比如水量、气压、喷嘴角度等。",
    image: "cover-water-rocket.png",
    tags: ["工程", "物理", "水火箭"],
    author: "小科学家",
    level: "LV5",
    comments: 23,
    likes: 128,
  },
  {
    title: "今天在校园看到的几种鸟类分享",
    desc: "早上在校园里观察到了几种常见的鸟类，拍到了它们的照片，和大家一起分享。",
    image: "cover-bird-campus.png",
    tags: ["自然观察", "生物", "校园"],
    author: "自然小达人",
    level: "LV4",
    comments: 18,
    likes: 96,
  },
  {
    title: "用数字对称创造美：我的几何艺术装置",
    desc: "受到数学对称性的启发，我用纸板和彩纸做了一个几何艺术装置，过程和成品分享给大家。",
    image: "cover-geometry-art.png",
    tags: ["艺术", "数学", "几何"],
    author: "创意工坊",
    level: "LV5",
    comments: 31,
    likes: 142,
  },
  {
    title: "电路小实验：让 LED 闪烁的 3 种方法",
    desc: "整理了三种让 LED 闪烁的电路方法，适合初学者，简单易学，快来试试吧。",
    image: "cover-circuit.png",
    tags: ["技术", "电子", "电路"],
    author: "电学小子",
    level: "LV4",
    comments: 27,
    likes: 115,
  },
  {
    title: "微观生态瓶制作记录",
    desc: "分享我的微观生态瓶制作过程，从材料准备到成品，记录每一步的变化。",
    image: "cover-terrarium.png",
    tags: ["科学", "生态", "植物"],
    author: "绿植研究所",
    level: "LV4",
    comments: 15,
    likes: 83,
  },
];

const challengeItems = [
  {
    title: "纸飞机飞行距离挑战赛",
    desc: "设计并制作一架纸飞机，测试飞行距离并分享你的设计思路。",
    image: "challenge-paper-plane.png",
    meta: "1,258 人参与",
    reward: "创客积分 × 200 + 贴纸套装",
  },
  {
    title: "30 天编程打卡挑战",
    desc: "连续 30 天完成编程学习或实践，每天进步一点点。",
    image: "challenge-coding.png",
    meta: "3,421 人已参与",
    reward: "电子徽章 + 创客积分 × 300",
  },
  {
    title: "废旧材料创意大赛",
    desc: "利用废旧材料，创作有用或有趣的作品，发挥你的创意。",
    image: "challenge-recycle.png",
    meta: "2,843 人参与",
    reward: "创客证书 + 精美礼品",
  },
];

const speciesItems = [
  ["白鹭", "Egretta garzetta", "圆明园福海", "cover-little-egret.png"],
  ["普通翠鸟", "Alcedo atthis", "奥森湿地", "hero-kingfisher.png"],
  ["绿头鸭", "Anas platyrhynchos", "城市湖泊", "cover-mallard.png"],
];

function esc(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function svgToDataUrl(svg) {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

async function ensureCleanDirs() {
  await fs.rm(OUT, { recursive: true, force: true });
  await Promise.all(Object.values(DIR).map((dir) => fs.mkdir(dir, { recursive: true })));
}

async function writeSvgPng(name, svg, options = {}) {
  const svgPath = path.join(DIR.assets, name.replace(/\.png$/, ".svg"));
  const pngPath = path.join(DIR.assets, name.replace(/\.svg$/, ".png"));
  await fs.writeFile(svgPath, svg);
  await sharp(Buffer.from(svg)).png(options).toFile(pngPath);
}

async function cropPhoto(src, name, width, height, position = "center") {
  await sharp(path.join(ROOT, src))
    .resize(width, height, { fit: "cover", position })
    .sharpen()
    .png()
    .toFile(path.join(DIR.assets, name));
}

function projectSvg(kind, title, width = 720, height = 420) {
  const palette = {
    rocket: ["#d8ecff", "#2d7df0", "#ff9f2e"],
    geometry: ["#f7e5ee", "#ef6fa5", "#2d7df0"],
    circuit: ["#dff4ff", "#1787d8", "#23b26f"],
    paper: ["#d6eaff", "#2d7df0", "#ffbc36"],
    coding: ["#d9e4ff", "#536dfe", "#20c997"],
    recycle: ["#edf5ea", "#3aaa64", "#f28c28"],
    terrarium: ["#e8f7ee", "#33a66f", "#95c13d"],
    game: ["#e8f0ff", "#2d7df0", "#19b98a"],
    lab: ["#eaf5ff", "#2176ff", "#20a96b"],
  }[kind] || ["#eaf5ff", "#2176ff", "#20a96b"];
  const [bg, primary, accent] = palette;
  const common = `
    <defs>
      <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stop-color="${bg}"/>
        <stop offset=".62" stop-color="#ffffff"/>
        <stop offset="1" stop-color="${primary}" stop-opacity=".28"/>
      </linearGradient>
      <filter id="shadow"><feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#10264d" flood-opacity=".18"/></filter>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#bg)"/>
    <path d="M0 ${height * 0.78} C ${width * 0.24} ${height * 0.62}, ${width * 0.42} ${height * 0.88}, ${width * 0.62} ${height * 0.72} S ${width * 0.86} ${height * 0.58}, ${width} ${height * 0.72} L ${width} ${height} L0 ${height}Z" fill="${primary}" opacity=".14"/>
    <path d="M0 ${height * 0.88} C ${width * 0.28} ${height * 0.72}, ${width * 0.48} ${height}, ${width * 0.76} ${height * 0.82} S ${width * 0.94} ${height * 0.78}, ${width} ${height * 0.84} L ${width} ${height} L0 ${height}Z" fill="${accent}" opacity=".18"/>
  `;
  const rocket = `
    <g transform="translate(${width * 0.48} ${height * 0.52}) rotate(-18)" filter="url(#shadow)">
      <rect x="-28" y="-128" width="56" height="206" rx="28" fill="#fff" stroke="#c9d9ea" stroke-width="4"/>
      <path d="M-28 -66 L-92 0 L-28 10Z" fill="${primary}"/>
      <path d="M28 -66 L92 0 L28 10Z" fill="${accent}"/>
      <circle cx="0" cy="-54" r="18" fill="#cfe8ff" stroke="${primary}" stroke-width="4"/>
      <path d="M-18 78 L0 142 L18 78Z" fill="${accent}"/>
      <path d="M0 142 C-22 174 -34 204 -40 236 M0 142 C18 180 28 204 34 236" stroke="#ffb347" stroke-width="10" stroke-linecap="round"/>
    </g>`;
  const geometry = `
    <g transform="translate(${width * 0.52} ${height * 0.52})" filter="url(#shadow)">
      <polygon points="0,-120 112,-38 70,98 -70,98 -112,-38" fill="#fff" stroke="${primary}" stroke-width="7"/>
      <circle cx="0" cy="0" r="68" fill="${accent}" opacity=".22"/>
      <path d="M-112 -38 L70 98 M112 -38 L-70 98 M0 -120 L0 98" stroke="#263f73" stroke-width="5" opacity=".48"/>
    </g>`;
  const circuit = `
    <g transform="translate(${width * 0.5} ${height * 0.52})" filter="url(#shadow)">
      <rect x="-180" y="-105" width="360" height="210" rx="24" fill="#0f3440"/>
      <path d="M-120 -48 H-22 V18 H76 V70 H132" fill="none" stroke="${primary}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M-124 58 H-62 V-12 H44 V-70 H126" fill="none" stroke="${accent}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="-120" cy="-48" r="16" fill="#ffd166"/><circle cx="132" cy="70" r="16" fill="#ffd166"/><circle cx="126" cy="-70" r="16" fill="#78f2c6"/>
    </g>`;
  const paper = `
    <g transform="translate(${width * 0.5} ${height * 0.48})" filter="url(#shadow)">
      <path d="M-210 -18 L190 -126 L52 118 L-36 34 Z" fill="#fff"/>
      <path d="M-36 34 L52 118 L34 10 Z" fill="#d9e7ff"/>
      <path d="M-210 -18 L34 10 L190 -126 Z" fill="#f8fbff"/>
      <path d="M-92 48 L-180 102 L-154 18 Z" fill="${accent}"/>
      <path d="M-122 16 L-214 82 L-188 -4 Z" fill="${primary}"/>
    </g>`;
  const coding = `
    <g transform="translate(${width * 0.5} ${height * 0.5})" filter="url(#shadow)">
      <rect x="-190" y="-118" width="380" height="236" rx="24" fill="#151a3b"/>
      <rect x="-150" y="-76" width="210" height="18" rx="9" fill="${primary}"/>
      <rect x="-150" y="-38" width="278" height="16" rx="8" fill="#56d5b3"/>
      <rect x="-150" y="0" width="246" height="16" rx="8" fill="#ffd166"/>
      <rect x="-150" y="38" width="172" height="16" rx="8" fill="#8ab4ff"/>
      <circle cx="128" cy="52" r="42" fill="${accent}"/>
    </g>`;
  const recycle = `
    <g transform="translate(${width * 0.5} ${height * 0.52})" filter="url(#shadow)">
      <rect x="-130" y="-100" width="260" height="210" rx="22" fill="#d1b58a"/>
      <circle cx="-70" cy="-20" r="42" fill="${primary}"/><circle cx="66" cy="-22" r="38" fill="${accent}"/>
      <path d="M-38 62 L-5 8 L28 62Z" fill="#fff" opacity=".9"/>
      <path d="M-12 18 H22 L8 -6" fill="none" stroke="${primary}" stroke-width="10" stroke-linejoin="round"/>
    </g>`;
  const terrarium = `
    <g transform="translate(${width * 0.5} ${height * 0.54})" filter="url(#shadow)">
      <rect x="-186" y="-108" width="94" height="210" rx="24" fill="rgba(255,255,255,.68)" stroke="#c9e7db" stroke-width="5"/>
      <rect x="-48" y="-128" width="116" height="230" rx="28" fill="rgba(255,255,255,.72)" stroke="#c9e7db" stroke-width="5"/>
      <rect x="112" y="-92" width="92" height="194" rx="24" fill="rgba(255,255,255,.70)" stroke="#c9e7db" stroke-width="5"/>
      <path d="M-170 52 C-132 10 -116 6 -100 52 M-28 48 C0 -16 32 -18 50 48 M128 52 C158 12 178 16 190 52" stroke="${primary}" stroke-width="12" fill="none" stroke-linecap="round"/>
      <rect x="-190" y="70" width="400" height="38" rx="19" fill="#7b5535" opacity=".82"/>
    </g>`;
  const game = `
    <g transform="translate(${width * 0.5} ${height * 0.5})" filter="url(#shadow)">
      <rect x="-176" y="-132" width="352" height="264" rx="28" fill="#fff"/>
      ${Array.from({ length: 5 }, (_, r) => Array.from({ length: 5 }, (_, c) =>
        `<rect x="${-126 + c * 62}" y="${-88 + r * 36}" width="42" height="24" rx="8" fill="${(r + c) % 2 ? "#91cdfc" : "#a9e7d1"}"/>`
      ).join("")).join("")}
      <rect x="-128" y="88" width="88" height="26" rx="13" fill="#ffd889"/><rect x="-22" y="88" width="88" height="26" rx="13" fill="#91cdfc"/><rect x="84" y="88" width="88" height="26" rx="13" fill="#a9e7d1"/>
    </g>`;
  const lab = `
    <g transform="translate(${width * 0.5} ${height * 0.54})" filter="url(#shadow)">
      <ellipse cx="0" cy="86" rx="250" ry="36" fill="#b9d6e6"/>
      <circle cx="-96" cy="-10" r="56" fill="#ffe0bd"/><circle cx="14" cy="-26" r="58" fill="#ffe0bd"/><circle cx="128" cy="-8" r="54" fill="#ffe0bd"/>
      <path d="M-150 -50 C-110 -112 -60 -80 -50 -30" fill="#253a64"/><path d="M-44 -82 C8 -138 72 -86 66 -28" fill="#253a64"/><path d="M88 -46 C126 -104 188 -76 176 -18" fill="#253a64"/>
      <rect x="-120" y="18" width="76" height="82" rx="18" fill="#80b7ff"/><rect x="-24" y="8" width="84" height="92" rx="18" fill="#fff"/><rect x="88" y="20" width="76" height="80" rx="18" fill="#9ac7ff"/>
      <rect x="-40" y="74" width="130" height="40" rx="12" fill="#253a64"/><circle cx="18" cy="72" r="34" fill="#ffbf37"/><rect x="-18" y="42" width="72" height="30" rx="10" fill="#2d7df0"/>
    </g>`;
  const art = { rocket, geometry, circuit, paper, coding, recycle, terrarium, game, lab }[kind] || lab;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${common}${art}<text x="36" y="${height - 34}" font-size="22" font-weight="800" fill="#10234a" font-family="PingFang SC, Microsoft YaHei, sans-serif">${esc(title)}</text></svg>`;
}

async function generateAssets() {
  await cropPhoto("public/birds/images/alcedo-atthis.jpg", "hero-kingfisher.png", 900, 420, "right");
  await cropPhoto("public/birds/images/little-egret.jpg", "cover-little-egret.png", 720, 420, "center");
  await cropPhoto("public/birds/images/mallard.jpg", "cover-mallard.png", 720, 420, "center");
  await cropPhoto("public/birds/images/alcedo-atthis.jpg", "cover-bird-campus.png", 720, 420, "right");
  await cropPhoto(".open-next/assets/projects/handmade_coaster.png", "cover-handmade-coaster.png", 720, 420, "center");
  await cropPhoto(".open-next/assets/projects/goldfish_observation.png", "cover-goldfish.png", 720, 420, "center");

  await sharp(path.join(ROOT, ".open-next/assets/projects/sensory_box.png"))
    .extract({ left: 0, top: 230, width: 1024, height: 620 })
    .resize(980, 360, { fit: "cover", position: "center" })
    .sharpen()
    .png()
    .toFile(path.join(DIR.assets, "hero-maker-lab.png"));
  await fs.writeFile(path.join(DIR.assets, "hero-maker-lab-source-note.txt"), "Cropped and resized from existing project asset .open-next/assets/projects/sensory_box.png for high-fidelity mockup use.\n");
  await writeSvgPng("cover-water-rocket.png", projectSvg("rocket", "自制水火箭"));
  await writeSvgPng("cover-geometry-art.png", projectSvg("geometry", "几何艺术装置"));
  await writeSvgPng("cover-circuit.png", projectSvg("circuit", "电路小实验"));
  await writeSvgPng("cover-terrarium.png", projectSvg("terrarium", "微观生态瓶"));
  await writeSvgPng("challenge-paper-plane.png", projectSvg("paper", "纸飞机飞行距离挑战", 720, 420));
  await writeSvgPng("challenge-coding.png", projectSvg("coding", "30 天编程打卡挑战", 720, 420));
  await writeSvgPng("challenge-recycle.png", projectSvg("recycle", "废旧材料创意大赛", 720, 420));
  await writeSvgPng("playground-game.png", projectSvg("game", "逻辑游乐场", 720, 420));
}

function iconSvg() {
  return svgToDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
    <path d="M22 4 38 13.2v17.6L22 40 6 30.8V13.2Z" fill="#e9f8f0"/>
    <path d="M22 8 34 15v14L22 36 10 29V15Z" fill="none" stroke="#1f9b63" stroke-width="3.4" stroke-linejoin="round"/>
    <path d="M15 18.5 22 14.5 29 18.5M15 25.5 22 29.5 29 25.5" stroke="#3779f6" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`);
}

function nav(active) {
  return `<header class="topbar">
    <div class="brand"><img src="${iconSvg()}" alt=""><strong>STEAM 探索</strong></div>
    <nav>${navItems.map(([label, mark]) => `<span class="${active === label ? "active" : ""}"><b>${mark}</b>${label}</span>`).join("")}</nav>
    <div class="search">⌕&nbsp;&nbsp;搜索讨论、用户、话题...</div>
    <div class="icons"><span>♧<em>3</em></span><span>✉<em>12</em></span><img src="${htmlAsset("avatar.png")}" alt=""><small>小小探索家⌄</small></div>
  </header>`;
}

function baseCss(view) {
  const mobile = view === "mobile";
  return `<style>
    *{box-sizing:border-box} body{margin:0;background:#f7faff;color:#14213d;font-family:"PingFang SC","Microsoft YaHei",Arial,sans-serif;-webkit-font-smoothing:antialiased}
    .screen{width:${mobile ? MOBILE.width : DESKTOP.width}px;min-height:${mobile ? MOBILE.height : DESKTOP.height}px;background:linear-gradient(180deg,#f8fbff 0%,#f5f8fc 100%);overflow:hidden}
    .topbar{height:58px;background:rgba(255,255,255,.94);display:flex;align-items:center;padding:0 ${mobile ? 16 : 42}px;border-bottom:1px solid #e8eef7;box-shadow:0 8px 24px rgba(36,64,112,.08);gap:26px}
    .brand{display:flex;align-items:center;gap:10px;min-width:${mobile ? 205 : 245}px}.brand img{width:34px;height:34px}.brand strong{font-size:24px;color:#0e2b68;letter-spacing:.5px}
    nav{display:${mobile ? "none" : "flex"};align-items:center;gap:24px;flex:1} nav span{height:58px;display:flex;align-items:center;gap:8px;color:#4b5873;font-size:15px;border-bottom:3px solid transparent;padding:0 4px} nav span.active{color:#126ef7;border-bottom-color:#126ef7;font-weight:700} nav b{font-size:17px;font-weight:500}
    .search{display:${mobile ? "none" : "flex"};align-items:center;width:284px;height:38px;border:1px solid #dfe7f3;border-radius:9px;color:#9aa6bd;padding:0 14px;font-size:13px;background:#fff}.icons{display:${mobile ? "none" : "flex"};align-items:center;gap:16px;color:#42506a}.icons span{position:relative;font-size:20px}.icons em{position:absolute;right:-8px;top:-9px;background:#ff4d4f;color:#fff;border-radius:999px;font-style:normal;font-size:10px;min-width:16px;height:16px;text-align:center;line-height:16px}.icons img{width:34px;height:34px;border-radius:50%;object-fit:cover}
    .mobile-title{display:${mobile ? "flex" : "none"};align-items:center;gap:12px;height:58px;background:#fff;border-bottom:1px solid #e8eef7;padding:0 18px}.mobile-title img{width:30px;height:30px}.mobile-title strong{font-size:18px;color:#10234a}
    .content{padding:${mobile ? "16px" : "18px 42px 40px"};display:grid;gap:${mobile ? 14 : 18}px}.desktop-grid{display:${mobile ? "block" : "grid"};grid-template-columns:1fr 445px;gap:18px}.panel{background:#fff;border:1px solid #e7edf6;border-radius:14px;box-shadow:0 8px 24px rgba(34,72,128,.05);overflow:hidden}.hero-grid{display:grid;grid-template-columns:${mobile ? "1fr" : "1fr 445px"};gap:18px}
    .hero{height:${mobile ? 240 : 210}px;position:relative;padding:${mobile ? 24 : 34}px;overflow:hidden;background:linear-gradient(105deg,#f4f9ff 0%,#eef7ff 52%,#ddecff 100%)}.hero h1{font-size:${mobile ? 28 : 34}px;line-height:1.1;margin:0 0 12px;color:#111b3d;letter-spacing:.5px;max-width:${mobile ? 210 : 460}px}.hero p{margin:0;color:#42506a;font-size:${mobile ? 13 : 15}px;max-width:${mobile ? 190 : 520}px}.hero img{position:absolute;right:0;bottom:0;width:${mobile ? 68 : 54}%;height:100%;object-fit:cover;object-position:center bottom;z-index:0}.hero:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(246,250,255,.98) 0%,rgba(246,250,255,.88) 42%,rgba(246,250,255,.10) 76%);z-index:1}
    .hero h1,.hero p,.hero .stats{position:relative;z-index:2}.stats{display:flex;gap:10px;margin-top:22px}.stat{width:${mobile ? 70 : 92}px;height:66px;border:1px solid #e4ebf5;background:rgba(255,255,255,.88);border-radius:9px;padding:10px 12px}.stat b{display:block;font-size:${mobile ? 18 : 21}px;color:#1575ff}.stat small{color:#6b7892}
    .feature{height:${mobile ? 198 : 210}px;padding:30px;position:relative;background:#f3faed;overflow:hidden}.feature h2{margin:0 0 10px;font-size:${mobile ? 19 : 22}px;max-width:${mobile ? 150 : 280}px}.feature p{margin:0;color:#4f5f74;font-size:14px;line-height:1.7;max-width:${mobile ? 148 : 300}px}.feature .btn{display:inline-flex;margin-top:${mobile ? 14 : 22}px;background:#279656;color:#fff;border-radius:7px;padding:10px 20px;font-weight:700}.feature img{position:absolute;right:0;bottom:0;width:${mobile ? 44 : 48}%;height:100%;object-fit:cover;z-index:0}.feature h2,.feature p,.feature .btn,.feature .badge{position:relative;z-index:1}.badge{position:absolute;right:18px;top:18px;background:#d9f2df;color:#22864d;border-radius:10px;padding:7px 12px;font-size:12px;font-weight:700;display:${mobile ? "none" : "block"}}
    .tabs{height:54px;display:flex;align-items:center;gap:34px;padding:0 24px;border-bottom:1px solid #e9eef6}.tabs span{height:54px;line-height:54px;font-size:18px}.tabs .active{color:#126ef7;font-weight:800;border-bottom:3px solid #126ef7}.filters{display:flex;gap:10px;flex-wrap:wrap;padding:${mobile ? "14px" : "18px 24px"};align-items:center}.chip{height:32px;border:1px solid #e0e7f2;border-radius:7px;padding:0 16px;display:inline-flex;align-items:center;background:#fff;color:#536176;font-size:14px}.chip.active{background:#1677ff;color:#fff;border-color:#1677ff;font-weight:700}.primary-btn{margin-left:auto;height:34px;background:#1677ff;color:#fff;border-radius:7px;padding:0 18px;display:inline-flex;align-items:center;font-weight:700}
    h3.section{margin:0;padding:0 24px 10px;font-size:18px;color:#122654}.list{padding:0 24px 18px}.row{display:grid;grid-template-columns:${mobile ? "100px 1fr" : "158px 1fr 120px"};gap:${mobile ? 12 : 18}px;padding:12px 0;border-bottom:1px solid #edf2f8}.row img{width:100%;height:${mobile ? 74 : 94}px;object-fit:cover;border-radius:7px}.row h4{margin:2px 0 6px;font-size:${mobile ? 15 : 17}px;color:#13203c}.row p{margin:0 0 8px;color:#68758d;font-size:${mobile ? 12 : 13}px;line-height:1.45}.tag{display:inline-flex;height:20px;padding:0 8px;align-items:center;border-radius:4px;background:#eaf4ff;color:#126ef7;font-size:12px;margin-right:6px}.meta{font-size:12px;color:#65728a;margin-top:8px}.metrics{display:${mobile ? "none" : "flex"};gap:22px;align-items:end;justify-content:flex-end;color:#6c7890;font-size:13px}
    .side{display:grid;gap:18px}.side-section{padding:18px}.side-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}.side-head h3{margin:0;font-size:19px;color:#122654}.side-head a{color:#126ef7;font-size:13px;text-decoration:none}.challenge-card{display:grid;grid-template-columns:130px 1fr;gap:16px;border:1px solid #e6edf7;border-radius:11px;background:#fbfdff;overflow:hidden;margin-bottom:14px}.challenge-card img{width:130px;height:124px;object-fit:cover}.challenge-card h4{margin:16px 0 8px;font-size:16px}.challenge-card p{margin:0 14px 12px 0;color:#536176;font-size:13px;line-height:1.5}.challenge-card small{color:#6c7890}.reward{margin-top:10px;color:#7b5a00;font-size:12px}
    .cards{display:grid;grid-template-columns:${mobile ? "1fr" : "repeat(3,1fr)"};gap:16px;padding:18px 24px 24px}.card{border:1px solid #e6edf7;border-radius:12px;background:#fff;overflow:hidden}.card img{width:100%;height:${mobile ? 150 : 138}px;object-fit:cover}.card div{padding:14px}.card h4{margin:0 0 8px;font-size:16px}.card p{margin:0;color:#68758d;font-size:13px;line-height:1.5}
    .form{display:grid;grid-template-columns:${mobile ? "1fr" : "1fr 360px"};gap:18px}.form-main,.form-side,.detail-main,.detail-side{padding:24px}.field{border:1px solid #e2e9f4;border-radius:10px;background:#fbfdff;padding:15px;margin-bottom:14px}.field label{display:block;font-weight:800;margin-bottom:8px}.field span{color:#8a96aa;font-size:13px}.textarea{height:112px}.upload{height:160px;border:1px dashed #b8c7dc;background:#f7fbff;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#678}
    .profile-head{display:grid;grid-template-columns:${mobile ? "1fr" : "260px 1fr"};gap:18px;padding:24px}.avatar{width:86px;height:86px;border-radius:50%;object-fit:cover}.radar{height:260px;background:radial-gradient(circle,#e9f4ff 0 18%,transparent 19%),conic-gradient(from 20deg,#1677ff44,#23a66f44,#ff9f2e44,#8e5cff44,#1677ff44);border-radius:18px;border:1px solid #e5edf7}
    .game-board{padding:24px}.board{width:${mobile ? 318 : 420}px;height:${mobile ? 318 : 420}px;display:grid;grid-template-columns:repeat(8,1fr);gap:4px;background:#dce8f4;border-radius:16px;padding:8px}.cell{border-radius:8px;background:#fff}.cell:nth-child(3n){background:#9dc9ff}.cell:nth-child(5n){background:#aee6d5}.mobile-only{display:${mobile ? "block" : "none"}}.desktop-only{display:${mobile ? "none" : "block"}}
  </style>`;
}

function statsBlock(items = ["28.7k 创客成员", "12.4k 讨论主题", "3.6k 本周活跃", "156 在线成员"]) {
  return `<div class="stats">${items.map((item) => {
    const [num, ...rest] = item.split(" ");
    return `<div class="stat"><b>${esc(num)}</b><small>${esc(rest.join(" "))}</small></div>`;
  }).join("")}</div>`;
}

function projectList(limit = 5) {
  return `<h3 class="section">🔥 热门讨论</h3><div class="list">${projectItems.slice(0, limit).map((item) => `
    <div class="row">
      <img src="${htmlAsset(item.image)}" alt="">
      <div><h4>${esc(item.title)}</h4><p>${esc(item.desc)}</p><div>${item.tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}</div><div class="meta">👤 ${item.author} <span class="tag">${item.level}</span> 2 小时前</div></div>
      <div class="metrics"><span>▱ ${item.comments}</span><span>♡ ${item.likes}</span></div>
    </div>`).join("")}</div>`;
}

function challengeSidebar() {
  return `<aside class="side">
    <section class="panel side-section">
      <div class="side-head"><h3>进行中的限时挑战</h3><a>查看更多 ›</a></div>
      ${challengeCard(challengeItems[0])}
    </section>
    <section class="panel side-section">
      <div class="side-head"><h3>长期学习挑战</h3><a>查看更多 ›</a></div>
      ${challengeCard(challengeItems[1])}
    </section>
    <section class="panel side-section">
      <div class="side-head"><h3>已结束挑战</h3><a>查看更多 ›</a></div>
      ${challengeCard(challengeItems[2])}
    </section>
  </aside>`;
}

function challengeCard(item) {
  return `<div class="challenge-card"><img src="${htmlAsset(item.image)}" alt=""><div><h4>${esc(item.title)}</h4><p>${esc(item.desc)}</p><small>♧ ${esc(item.meta)}</small><div class="reward">🏆 奖励：${esc(item.reward)}</div></div></div>`;
}

function communityDesktop() {
  return `<div class="hero-grid">
    <section class="panel hero"><h1>STEAM 创客社区</h1><p>分享想法，交流经验，一起用创造改变世界</p>${statsBlock()}<img src="${htmlAsset("hero-maker-lab.png")}" alt=""></section>
    <section class="panel feature"><span class="badge">本期专题</span><h2>自然观察专题挑战</h2><p>观察自然，记录生命，保护我们共同的家园</p><span class="btn">参与专题挑战</span><img src="${htmlAsset("hero-kingfisher.png")}" alt=""></section>
  </div>
  <div class="desktop-grid">
    <section class="panel"><div class="tabs"><span class="active">讨论区</span><span>挑战</span></div><div class="filters">${["推荐", "最新", "精华", "科学", "技术", "工程", "艺术", "数学", "自然观察"].map((x, i) => `<span class="chip ${i === 0 ? "active" : ""}">${x}</span>`).join("")}<span class="primary-btn">✎ 发布讨论</span></div>${projectList()}</section>
    ${challengeSidebar()}
  </div>`;
}

function genericHero(page) {
  const config = {
    home: ["让好奇心变成作品", "项目学习、自然观察与创客社区在同一处汇合", "hero-maker-lab.png"],
    listing: ["探索项目", "按学科、难度和标签发现适合当前阶段的实践项目", "cover-water-rocket.png"],
    detail: ["自制水火箭", "通过气压、结构和测试记录理解推进原理", "cover-water-rocket.png"],
    form: ["分享你的创意", "把过程、材料、步骤和反思整理成可复现的学习项目", "cover-geometry-art.png"],
    challenge: ["春季校园鸟类观察挑战", "连续 7 天记录校园鸟类活动，提交过程证据", "hero-kingfisher.png"],
    nature: ["自然观察，从身边开始", "记录鸟类、昆虫、植物和真菌，沉淀自然档案", "cover-little-egret.png"],
    species: ["白鹭 Egretta garzetta", "自然百科、社区观察和记录入口整合在一个档案中", "cover-little-egret.png"],
    profile: ["林小溪的成长主页", "作品、徽章、雷达图和学习轨迹集中展示", "cover-goldfish.png"],
    auth: ["欢迎回到 STEAM 探索", "安全登录、注册和找回密码三态合一", "hero-maker-lab.png"],
    messages: ["消息中心", "回复、喜欢、新粉丝与私信会话集中管理", "cover-circuit.png"],
    discussion: ["校园里最适合做自然观察的地点有哪些？", "真实社区讨论详情，支持点赞、举报和嵌套回复", "cover-bird-campus.png"],
    "nature-list": ["观察记录", "结构化的自然观察档案流，支持筛选和排序", "hero-kingfisher.png"],
    observation: ["白鹭观察记录", "主照片、时间地点、地图和评论组成科学记录详情", "cover-little-egret.png"],
    chat: ["与小竹的私信", "轻量清晰的站内 IM 对话界面", "cover-circuit.png"],
    leaderboard: ["社区排行榜", "积分榜、徽章榜和实干榜展示学习荣誉", "cover-geometry-art.png"],
    shop: ["个性化装扮与奖励", "硬币余额、交易记录和装扮商店统一管理", "challenge-recycle.png"],
    settings: ["设置", "账号、安全、外观、隐私和帮助入口清晰分组", "cover-circuit.png"],
    admin: ["管理员控制台", "审核、举报、挑战、标签和用户的运营后台", "cover-circuit.png"],
    playground: ["STEAM 逻辑游乐场", "把数学、算法和推理游戏做成轻量练习入口", "playground-game.png"],
    game: [page.title.replace("页面", ""), "稳定棋盘、状态反馈和学习提示，适合桌面与移动端", "playground-game.png"],
  }[page.kind] || ["STEAM 探索", "面向青少年与亲子用户的项目学习平台", "hero-maker-lab.png"];
  return `<section class="panel hero"><h1>${esc(config[0])}</h1><p>${esc(config[1])}</p>${statsBlock(page.kind === "nature" ? ["1.4k 观察记录", "186 物种档案", "34 热点地点"] : undefined)}<img src="${htmlAsset(config[2])}" alt=""></section>`;
}

function cardsGrid(items = projectItems) {
  return `<section class="panel"><div class="tabs"><span class="active">推荐内容</span><span>最新</span><span>收藏</span></div><div class="cards">${items.slice(0, 6).map((item) => `<div class="card"><img src="${htmlAsset(item.image || item[3])}" alt=""><div><h4>${esc(item.title || item[0])}</h4><p>${esc(item.desc || `${item[1]} · ${item[2]}`)}</p></div></div>`).join("")}</div></section>`;
}

function formView(page) {
  return `<div class="form"><section class="panel form-main"><div class="tabs"><span class="active">${esc(page.title)}</span><span>预览</span></div><div style="padding:24px"><div class="upload">上传封面 / 作品图片</div>${["标题", "分类与标签", "步骤说明", "材料清单", "反思总结"].map((x, i) => `<div class="field ${i === 3 ? "textarea" : ""}"><label>${x}</label><span>请输入${x}，保存后可继续编辑</span></div>`).join("")}</div></section><aside class="panel form-side"><h3>提交前检查</h3>${["信息完整", "图片清晰", "过程证据", "可公开展示"].map((x) => `<div class="field"><label>${x}</label><span>已通过</span></div>`).join("")}</aside></div>`;
}

function detailView(page) {
  return `<div class="desktop-grid"><section class="panel detail-main"><div class="tabs"><span class="active">详情</span><span>作品墙</span><span>评论</span></div><div style="padding:24px"><img src="${htmlAsset(page.kind === "species" || page.kind === "observation" ? "cover-little-egret.png" : "cover-water-rocket.png")}" style="width:100%;height:280px;object-fit:cover;border-radius:12px;margin-bottom:20px"><h2>${page.kind === "species" ? "识别特征与观察数据" : "学习目标与实践步骤"}</h2><p style="color:#5e6b82;line-height:1.8">页面以真实内容优先，图像、统计、行动按钮和评论区形成完整产品闭环，后续重构可按卡片、时间线、互动区拆分组件。</p>${["准备材料", "完成实验", "记录结果", "提交作品"].map((x, i) => `<div class="field"><label>${i + 1}. ${x}</label><span>清晰说明用户在此步骤需要完成的动作。</span></div>`).join("")}</div></section><aside class="side">${challengeSidebar()}</aside></div>`;
}

function settingsView(page) {
  const entries = ["个人资料", "账号与安全", "外观", "消息与通知", "隐私设置", "关于与帮助"];
  return `<section class="panel"><div class="cards">${entries.map((x, i) => `<div class="card"><img src="${htmlAsset(["cover-goldfish.png", "cover-circuit.png", "challenge-recycle.png"][i % 3])}" alt=""><div><h4>${x}</h4><p>清晰说明当前状态，点击进入对应设置。</p></div></div>`).join("")}</div></section>`;
}

function gameView(page) {
  return `<section class="panel game-board"><div class="tabs"><span class="active">${esc(page.title)}</span><span>提示</span><span>排行榜</span></div><div style="display:flex;gap:28px;align-items:flex-start;padding:24px;flex-wrap:wrap"><div class="board">${Array.from({ length: 64 }, (_, i) => `<span class="cell">${i % 13 === 0 ? "●" : ""}</span>`).join("")}</div><div style="min-width:260px;flex:1">${["当前状态：进行中", "用时：08:26", "难度：中级", "提示：观察模式变化"].map((x) => `<div class="field"><label>${x}</label><span>固定尺寸控制区，不挤压核心棋盘。</span></div>`).join("")}</div></div></section>`;
}

function adminView() {
  return `<section class="panel"><div class="tabs"><span class="active">待审核项目</span><span>待审核作品</span><span>举报管理</span><span>用户</span></div><div class="list">${projectItems.slice(0, 4).map((item) => `<div class="row"><img src="${htmlAsset(item.image)}"><div><h4>${item.title}</h4><p>提交人 ${item.author} · 状态：待审核 · 优先级 P2</p><span class="tag">通过</span><span class="tag">拒绝</span><span class="tag">查看详情</span></div><div class="metrics"><span>待处理</span></div></div>`).join("")}</div></section>`;
}

function pageBody(page, view) {
  if (page.kind === "community") return communityDesktop();
  if (page.kind === "form") return `${genericHero(page)}${formView(page)}`;
  if (["detail", "challenge", "species", "discussion", "observation"].includes(page.kind)) return `${genericHero(page)}${detailView(page)}`;
  if (page.kind === "settings") return `${genericHero(page)}${settingsView(page)}`;
  if (page.kind === "admin") return `${genericHero(page)}${adminView()}`;
  if (["game", "playground"].includes(page.kind)) return `${genericHero(page)}${gameView(page)}`;
  if (page.kind === "nature" || page.kind === "nature-list") return `${genericHero(page)}${cardsGrid(speciesItems.map(([title, latin, place, image]) => ({ title, desc: `${latin} · ${place}`, image })))}`;
  if (page.kind === "chat" || page.kind === "messages") return `${genericHero(page)}<section class="panel"><div class="list">${["小竹：我把鸟类观察路线整理好了", "林小溪：我会补充地图截图", "系统：请勿分享个人隐私信息", "阿远：水火箭挑战要不要组队？"].map((x) => `<div class="field"><label>${x}</label><span>刚刚 · 已读</span></div>`).join("")}</div></section>`;
  if (page.kind === "profile") return `${genericHero(page)}${cardsGrid()}`;
  if (page.kind === "auth") return `${genericHero(page)}${formView(page)}`;
  if (page.kind === "leaderboard" || page.kind === "shop") return `${genericHero(page)}${cardsGrid(challengeItems)}`;
  return `${genericHero(page)}${cardsGrid()}`;
}

function renderHtml(page, view) {
  const mobile = view === "mobile";
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(page.title)}</title>${baseCss(view)}</head><body><div class="screen">${mobile ? `<div class="mobile-title"><img src="${iconSvg()}"><strong>${esc(page.title)}</strong></div>` : nav(page.nav)}<main class="content">${pageBody(page, view)}</main></div></body></html>`;
}

async function writeAvatar() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" rx="80" fill="#e8f4ff"/><circle cx="80" cy="66" r="34" fill="#f3c8a9"/><path d="M42 60c8-34 68-46 82 0-18-12-46-18-82 0Z" fill="#3a2c2a"/><rect x="38" y="96" width="84" height="48" rx="24" fill="#2d7df0"/><circle cx="68" cy="68" r="5" fill="#17233f"/><circle cx="94" cy="68" r="5" fill="#17233f"/><path d="M66 86c10 8 22 8 32 0" stroke="#17233f" stroke-width="5" fill="none" stroke-linecap="round"/></svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(DIR.assets, "avatar.png"));
}

async function writeHtml() {
  for (const page of pages) {
    await fs.writeFile(path.join(DIR.htmlPc, `${page.id}.html`), renderHtml(page, "pc"));
    await fs.writeFile(path.join(DIR.htmlMobile, `${page.id}.html`), renderHtml(page, "mobile"));
  }
}

async function screenshotAll() {
  const browser = await chromium.launch({ headless: true });
  for (const pageSpec of pages) {
    for (const [view, dir, viewport] of [["pc", DIR.htmlPc, DESKTOP], ["mobile", DIR.htmlMobile, MOBILE]]) {
      const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
      const file = path.join(dir, `${pageSpec.id}.html`);
      await page.goto(`file://${file}`);
      await page.screenshot({ path: path.join(view === "pc" ? DIR.pc : DIR.mobile, `${pageSpec.id}.png`), clip: { x: 0, y: 0, width: viewport.width, height: viewport.height } });
      await page.close();
    }
  }
  await browser.close();
}

function indexHtml() {
  const cards = pages.map((page) => `<article><h2>${page.prompt}. ${page.title}</h2><p>${page.route}</p><div><a href="./pc/${page.id}.png"><img src="./pc/${page.id}.png"></a><a href="./mobile/${page.id}.png"><img src="./mobile/${page.id}.png"></a></div></article>`).join("");
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>STEAM 探索高保真设计稿</title><style>body{margin:0;background:#f7faff;font-family:Arial,"Microsoft YaHei",sans-serif;color:#14213d}header{padding:42px}h1{margin:0 0 8px;font-size:36px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:22px;padding:0 42px 64px}article{background:#fff;border:1px solid #e6edf7;border-radius:16px;padding:16px;box-shadow:0 10px 28px rgba(34,72,128,.08)}h2{font-size:17px;margin:0 0 4px}p{color:#68758d;margin:0 0 12px}article div{display:grid;grid-template-columns:1fr 110px;gap:10px}img{width:100%;border-radius:10px;border:1px solid #e6edf7;display:block}article a:last-child img{height:240px;object-fit:cover;object-position:top}</style></head><body><header><h1>STEAM 探索高保真页面设计稿</h1><p>PC + 移动端截图，以及可复用开发图片资产。</p></header><main class="grid">${cards}</main></body></html>`;
}

function readme() {
  const rows = pages.map((page) => `| ${page.prompt} | ${page.title} | \`${page.route}\` | [PC](./pc/${page.id}.png) | [移动端](./mobile/${page.id}.png) |`).join("\n");
  return `# STEAM 探索高保真页面设计稿

本目录是面向后续重构的高保真 UI screenshot 设计稿，参考 \`docs/UI_GPT_DESIGN_PROMPTS.md\` 与用户提供的社区页示例重做。

## 输出

- \`pc/*.png\`: PC 设计稿，${DESKTOP.width} x ${DESKTOP.height}
- \`mobile/*.png\`: 移动端设计稿，${MOBILE.width} x ${MOBILE.height}
- \`html/pc/*.html\` / \`html/mobile/*.html\`: 可检查的静态设计稿源文件
- \`assets/*\`: 后续开发可直接复用的 hero、封面、挑战背景、头像等图片资产
- \`manifest.json\`: 页面到设计稿、HTML、主资产的映射
- \`index.html\`: 全部设计稿总览

## 页面清单

| # | 页面 | 路由 | PC | 移动端 |
|---:|---|---|---|---|
${rows}

## 重新生成

\`\`\`bash
node scripts/generate-ui-design-mockups.mjs
\`\`\`
`;
}

async function writeMeta() {
  const assetFiles = (await fs.readdir(DIR.assets)).sort();
  const manifest = {
    generatedBy: "scripts/generate-ui-design-mockups.mjs",
    styleReference: "High-fidelity product UI screenshot, matching the supplied community-page reference.",
    pcSize: DESKTOP,
    mobileSize: MOBILE,
    pages: pages.map((page) => ({
      id: page.id,
      prompt: page.prompt,
      title: page.title,
      route: page.route,
      kind: page.kind,
      pc: `pc/${page.id}.png`,
      mobile: `mobile/${page.id}.png`,
      pcHtml: `html/pc/${page.id}.html`,
      mobileHtml: `html/mobile/${page.id}.html`,
    })),
    assets: assetFiles.map((file) => asset(file)),
  };
  await fs.writeFile(path.join(OUT, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await fs.writeFile(path.join(OUT, "README.md"), readme());
  await fs.writeFile(path.join(OUT, "index.html"), indexHtml());
}

async function main() {
  await ensureCleanDirs();
  await generateAssets();
  await writeAvatar();
  await writeHtml();
  await screenshotAll();
  await writeMeta();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
