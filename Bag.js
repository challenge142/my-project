// ==UserScript==
// @name         Donguri Bag Enhancer
// @namespace    https://donguri.5ch.net/
// @version      8.0.1
// @description  5ちゃんねる「どんぐりシステム」の「アイテムバッグ」ページ機能改良スクリプト。
// @author       どんぐりID: bb97c8d2
// @contributor  ChatGPT (OpenAI, assistant)
// @license      Non-Commercial Personal Use Only
// @updateURL    https://github.com/bb97c8d2/Donguri_Bag_Enhancer/raw/main/Donguri_Bag_Enhancer.user.js
// @downloadURL  https://github.com/bb97c8d2/Donguri_Bag_Enhancer/raw/main/Donguri_Bag_Enhancer.user.js
// @match        https://donguri.5ch.net/bag
// @match        https://donguri.5ch.net/transfer
// @run-at       document-end
// @grant        none
// ==/UserScript==

// 〓〓〓〓〓〓 共通定義 〓〓〓〓〓〓
(function(){
  'use strict';

  // 設定キー
  const anchorKey   = 'donguriItemTableResetAnchor';
  const overlayId   = 'donguriLoadingOverlay';
  const tableIds    = ['necklaceTable','weaponTable','armorTable'];
  // 先に定義してからエイリアスで参照（未定義参照を防ぐ）
  const HIDE_KEY       = 'donguriHideRecycleBtn';
  const SHOW_DELTA_KEY = 'donguriShowDeltaColumn';

  // スクリプト自身のバージョン（About 表示用）
  const DBE_VERSION    = '8.0.1';

  // デバイスに応じた基準文字サイズの初期値（PC/タブレット=16px、スマホ=14px）
  function getDefaultBaseFontSize(){
    try{
      const ua = navigator.userAgent || '';
      const isMobi = /Mobi|iPhone|Windows Phone|Android.+Mobile/.test(ua);
      const vpMin  = Math.min(window.innerWidth || 0, window.innerHeight || 0);
      const isSmallViewport = vpMin > 0 ? (vpMin <= 768) : false;
      return (isMobi || isSmallViewport) ? '14px' : '16px';
    }catch(_e){
      return '16px';
    }
  }

  // 設定キー（新しい安定ID ? 既存キー のエイリアス）
  const DBE_KEYS = {    unlockedColor: { id:'dbe-prm-panel0-setcol...ll-unlocked', legacy:'unlockedColor',           def:'#ff6600' },    lockedColor:   { id:'dbe-prm-panel0-setcolor-cell-locked',   legacy:'lockedColor',             def:'#ffffff' },
    showDelta:     { id:'dbe-prm-panel0-check-display-necClm-Dlta', legacy: SHOW_DELTA_KEY,        def:false     },
    hideKindClass: { id:'dbe-prm-panel0-check-hide-NameSub', legacy:null, def:false  },
    hideLockCol:   { id:'dbe-prm-panel0-check-hide-Clm-Lock',       legacy:null,                   def:false     },
    hideRyclCol:   { id:'dbe-prm-panel0-check-hide-Clm-Rycl',       legacy:'donguriHideColumn-global', def:false  },
    hideAllBtn:    { id:'dbe-prm-panel0-check-hide-RyclUnLck',      legacy: HIDE_KEY,              def:false     },
    baseFontSize:  { id:'dbe-prm-panel0-fontsize',                  legacy:null,                   def:getDefaultBaseFontSize() },
  };

  function readStr(key){ const {id,legacy,def}=DBE_KEYS[key]; const v = localStorage.getItem(id); if (v!=null) return v; const w = legacy? localStorage.getItem(legacy): null; return (w!=null)? w: def; }
  function readBool(key){ const v = readStr(key); return (v==='true'||v===true); }
  function writeStr(key,val){ const {id,legacy}=DBE_KEYS[key]; localStorage.setItem(id,val); if (legacy) localStorage.setItem(legacy,val); }
  function writeBool(key,val){ writeStr(key, String(!!val)); }
  const titleMap    = { necklaceTable: 'necklaceTitle', weaponTable: 'weaponTitle', armorTable: 'armorTitle' };
  const labelMap    = { necklaceTable: '━━ ネックレス ━━', weaponTable: '━━ 武器 ━━', armorTable: '━━ 防具 ━━' };
  const columnIds   = {
    necklaceTable: { 'ネックレス':'necClm-Name','装':'necClm-Equp','解':'necClm-Lock','属性':'necClm-StEf','マリモ':'necClm-Mrim','分解':'necClm-Rycl','増減':'necClm-Dlta' },
    weaponTable:   { '武器':'wepClm-Name','装':'wepClm-Equp','解':'wepClm-Lock','ATK':'wepClm-Atk','SPD':'wepClm-Spd','CRIT':'wepClm-Crit','ELEM':'wepClm-Elem','MOD':'wepClm-Mod','マリモ':'wepClm-Mrim','分解':'wepClm-Rycl' },
    armorTable:    { '防具':'amrClm-Name','装':'amrClm-Equp','解':'amrClm-Lock','DEF':'amrClm-Def','WT.':'amrClm-Wgt','CRIT':'amrClm-Crit','ELEM':'amrClm-Elem','MOD':'amrClm-Mod','マリモ':'amrClm-Mrim','分解':'amrClm-Rycl' }
  };
  const elemColors  = { '火':'#FFEEEE','氷':'#EEEEFF','雷':'#FFFFEE','風':'#EEFFEE','地':'#FFF0E0','水':'#EEFFFF','光':'#FFFFF0','闇':'#F0E0FF','なし':'#FFFFFF' };
  const elemOrder   = { '火':0,'氷':1,'雷':2,'風':3,'地':4,'水':5,'光':6,'闇':7,'なし':8 };
  const rarityOrder = { 'UR':0,'SSR':1,'SR':2,'R':3,'N':4 };

  const gradeOrder  = { 'Pt':0,'Au':1,'Ag':2,'CuSn':3,'Cu':4 };
  const gradeNames  = { 'Pt':'プラチナ','Au':'金','Ag':'銀','CuSn':'青銅','Cu':'銅' };
  const buffKeywords   = ['強化された','増幅された','力を増した','クリアになった','加速した','高まった','固くなった','尖らせた'];
  const debuffKeywords = ['静まった','弱まった','制限された','ぼやけた','減速した','減少した','砕けた','薄まった','緩んだ','侵食された','鈍らせた'];
  const statusMap      = {
    '攻撃の嵐':'storm','元素の混沌':'chaos','破滅の打撃':'blow','解き放たれた力':'release',
    '精度の道':'accuracy','時間の流れ':'time','生命の本質':'life','石の守り':'stone',
    '守護者の直感':'intuition','影のヴェール':'veil','運命の手':'hand','運命の盾':'shield','運命の賭博':'bet'
  };

  // アイテムIDフィルターの「数値ボックス」の初期値（あとで容易に変更できるよう共通定義に配置）
  // ※ UI の <input type="number"> には id="dbe-filterui-itemidfilter-threshold" を付与します
  const DEFAULT_ITEMIDFILTER_THRESHOLD = 169000000;


  // ──────────────────────────────────────────
  // 統一レジストリ方式：表示名 -> { kana, limited }
  //   ※下のレジストリから派生構造（weaponKana/armorKana, limitedWeapon/limitedArmor）を自動生成します
  // ──────────────────────────────────────────
  function makeKey(s){
    if (!s) return '';
    return s.normalize('NFKC').toUpperCase().trim();
  }

  // レジストリ（武器）
  const weaponRegistry = new Map([
    ['F5アタック',           { kana:'F5アタック',            limited:false }],
    ['怒りの黒電話',         { kana:'イカリノクロデンワ',    limited:false }],
    ['おたま',               { kana:'オタマ',                limited:false }],
    ['おにぎらず',           { kana:'オニギラズ',            limited:false }],
    ['熊手',                 { kana:'クマデ',                limited:false }],
    ['高圧洗浄機',           { kana:'コウアツセンジョウキ',  limited:false }],
    ['小枝',               { kana:'コエダ',                limited:false }],
    ['小枝の刀',           { kana:'コエダノカタナ',        limited:false }],
    ['ゴムチキン',           { kana:'ゴムチキン',            limited:false }],
    ['白胡椒',               { kana:'シロコショウ',          limited:false }],
    ['スリングショット',     { kana:'スリングショット',      limited:false }],
    ['どんぐり大砲',         { kana:'ドングリタイホウ',      limited:false }],
    ['どんぐりハンマ',       { kana:'ドングリハンマ',        limited:false }],
    ['ヌンチャク',           { kana:'ヌンチャク',            limited:false }],
    ['伸び切ったゴム紐',     { kana:'ノビキッタゴムヒモ',    limited:false }],
    ['ハエ叩き',             { kana:'ハエタタキ',            limited:false }],
    ['はたき',               { kana:'ハタキ',                limited:false }],
    ['棒',                   { kana:'ボウ',                  limited:false }],
    ['ほうき',               { kana:'ホウキ',                limited:false }],
    ['ママさんダンプ',       { kana:'ママサンダンプ',        limited:false }],
    ['ムチ',                 { kana:'ムチ',                  limited:false }],
    ['モバイルバッテリー',   { kana:'モバイルバッテリー',    limited:false }],
    // 限定（武器）
    ['カエルの拡声器',       { kana:'カエルノカクセイキ',    limited:true  }],
    ['カエルのメガホン',     { kana:'カエルノメガホン',      limited:true  }],
    ['セミのソニックキャン', { kana:'セミノソニックキャン',  limited:true  }],
    ['花火',                 { kana:'ハナビ',                limited:true  }],
    ['うちわ',               { kana:'ウチワ',                limited:true  }],
    ['練達のバット',         { kana:'レンタツノバット',      limited:true  }],
    ['キャンディケインの剣', { kana:'キャンディケインノケン',limited:true  }],
    ['狩人罠',               { kana:'カリウドワナ',          limited:true  }],
    ['猟犬笛',               { kana:'リョウケンブエ',        limited:true  }],
    ['投縄網',               { kana:'ナゲナワアミ',          limited:true  }],
    ['狐火閃光',             { kana:'キツネビセンコウ',      limited:true  }],
  ]);

  // レジストリ（防具）
  const armorRegistry = new Map([
    ['SPF50＋',           { kana:'SPF50プラス',          limited:false }],
    ['羽毛のマント',     { kana:'ウモウノマント',       limited:false }],
    ['割烹着',           { kana:'カッポウギ',           limited:false }],
    ['木の鎧',           { kana:'キノヨロイ',           limited:false }],
    ['硬化木の鎧',       { kana:'コウカキノヨロイ',     limited:false }],
    ['座布団',           { kana:'ザブトン',             limited:false }],
    ['たぬきの着ぐるみ', { kana:'タヌキノキグルミ',     limited:false }],
    ['段ボールの鎧',     { kana:'ダンボールノヨロイ',   limited:false }],
    ['デカすぎる兜',     { kana:'デカスギルカブト',     limited:false }],
    ['どんぐりかたびら', { kana:'ドングリカタビラ',     limited:false }],
    ['葉っぱの鎧',       { kana:'ハッパノヨロイ',       limited:false }],
    ['プチプチ巻き',     { kana:'プチプチマキ',         limited:false }],
    ['布団',             { kana:'フトン',               limited:false }],
    ['防弾カバン',       { kana:'ボウダンカバン',       limited:false }],
    // 限定（防具）
    ['セミの抜け殻',     { kana:'セミノヌケガラ',       limited:true  }],
    ['水着',             { kana:'ミズギ',               limited:true  }],
    ['ゆかた',           { kana:'ユカタ',               limited:true  }],
    ['ウサギの耳',       { kana:'ウサギノミミ',         limited:true  }],
    ['猫耳カチューシャ', { kana:'ネコミミカチューシャ', limited:true  }],
    ['ナイトロダッシュ', { kana:'ナイトロダッシュ',     limited:true  }],
    ['ニトロダッシュ',   { kana:'ニトロダッシュ',       limited:true  }],
    ['トナカイの装',     { kana:'トナカイノヨソオイ',   limited:true  }],
  ]);

  // ── 派生構造（互換用：既存コードが参照） ──────────────
  const weaponKana = new Map();
  const armorKana  = new Map();
  const limitedWeapon = new Set();
  const limitedArmor  = new Set();
  const weaponKeyToName = new Map();
  const armorKeyToName  = new Map();

  function buildDerivedStructures(){
    // 武器
    for (const [name, meta] of weaponRegistry.entries()){
      const key = makeKey(name);
      if (weaponKeyToName.has(key) && weaponKeyToName.get(key) !== name){
        console.warn('[DBE] weapon name key collision:', name, 'vs', weaponKeyToName.get(key));
      } else {
        weaponKeyToName.set(key, name);
      }
      if (meta && typeof meta.kana === 'string' && meta.kana.trim()){
        weaponKana.set(name, meta.kana.trim());
      }
      if (meta && meta.limited === true){
        limitedWeapon.add(name);
      }
    }
    // 防具
    for (const [name, meta] of armorRegistry.entries()){
      const key = makeKey(name);
      if (armorKeyToName.has(key) && armorKeyToName.get(key) !== name){
        console.warn('[DBE] armor name key collision:', name, 'vs', armorKeyToName.get(key));
      } else {
        armorKeyToName.set(key, name);
      }
      if (meta && typeof meta.kana === 'string' && meta.kana.trim()){
        armorKana.set(name, meta.kana.trim());
      }
      if (meta && meta.limited === true){
        limitedArmor.add(name);
      }
    }
  }
  buildDerivedStructures();

  // Lock/Unlockリンクの状態をソートするための順位付け
  const secrOrder = { 'secured': 0, 'released': 1 };

  // --- 共通定義: SVG矢印（基本サイズ1em、左右余白0.1em） ---
  const ARROW_SVG = {
    up: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" width="1em" height="1em" style="vertical-align:middle;margin:0 0.1em"><path d="M1 6 L5 2 L9 6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
    down:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" width="1em" height="1em" style="vertical-align:middle;margin:0 0.1em"><path d="M1 4 L5 8 L9 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`
  };

  // --- ソートインジケーター更新ヘルパー ---
  /**
  * @param {HTMLElement} th - ヘッダー th
  * @param {'?'|'?'} arrow - 矢印
  * @param {'left'|'right'} position - インジケーター位置
  * @param {string=} label - インジケータ内に表示するテキスト（例: 'Rarity','限定','カナ'）
  */

  function updateSortIndicator(th, arrow, position, label) {
    // 既存のインジケーターを全て削除（ヘッダー行内）
    th.parentNode
      .querySelectorAll('.sort-indicator, .sort-indicator-left')
      .forEach(el => el.remove());
    const span = document.createElement('span');

    // 共通クラス付与
    if (position === 'left') {
      span.classList.add('sort-indicator-left');
    } else {
      span.classList.add('sort-indicator');
    }

    // インジケーター本体
    const svg = ARROW_SVG[ arrow === '?' ? 'down' : 'up' ];
    if (label) {
      // (SVG) テキスト の形で表示（ブラケット無し）、テキストは 0.8em
      span.innerHTML = `${svg}<span class="sort-label">${label}</span>`;
    } else {
      // 互換：矢印のみ
      span.innerHTML = svg;
    }

    // thの先頭 or 末尾に挿入
    if (position === 'left') {
      th.insertBefore(span, th.firstChild);
    } else {
      th.appendChild(span);
    }

    // 最終ソートをグローバルに記憶
    const allColumnClasses = [
      ...Object.values(columnIds.necklaceTable),
      ...Object.values(columnIds.weaponTable),
      ...Object.values(columnIds.armorTable)
    ];
    // th に付いている class のうち、columnIds のいずれかを見つける
    const colClass = Array.from(th.classList).find(c => allColumnClasses.includes(c)) || null;
    lastSortedColumn  = colClass;
    // '?' を正順、'?' を逆順とみなす
    lastSortAscending = (arrow === '?');
  }

  // --- 最後に使用したソート関数を記憶するマップ（先に初期化） ---
  const lastSortMap = {};

  // --- 最後にソートされた列と方向を記憶 ---
  let lastSortedColumn  = null;  // 最後にソートされた列の class 名 (columnIds のいずれか)
  let lastSortAscending = null;  // true=正順(?), false=逆順(?)

  // --- 状態管理変数 ---
  let lastClickedCellId = null;
  let recycleTableId    = null;
  let recycleItemId     = null;

  // --- Transfer ページ用: 送信先IDをデフォルト入力（サブウインドウからの遷移時のみ） ---
  if (location.pathname === '/transfer') {
    window.addEventListener('load', ()=>{
      if (localStorage.getItem('donguriAutoTransfer') === 'bb97c8d2') {
        const input = document.getElementById('recipientid');
        if (input) input.value = 'bb97c8d2';
        localStorage.removeItem('donguriAutoTransfer');
      }
    });
    return;
  }

  // --- 初期化処理 ---
  function initAll(){
    // --- 関数呼び出し ---
    replaceTreasureLinks();
    insertItemSummary();

// 〓〓〓〓〓〓 装備中アイテム見出し＆テーブルID付与 〓〓〓〓〓〓
    (function insertEquippedSection(){
      const header = document.querySelector('header');
      if (!header) return;
      // 見出しの挿入
        header.insertAdjacentHTML('afterend',
          '<h2 style="font-size:1.5em; margin-top:1em;"><span style="color:red;">&block;</span> 装備中のアイテム</h2>'
        );
        document.querySelectorAll('h3').forEach(h3 => {
          const text = h3.textContent.trim();
          if (!text.includes('装備している')) return;
          // ★(1) 「この h3 の次の兄弟要素」から順にたどって先に見つかった <table> 要素を拾う
          let el = h3.nextElementSibling;
          while (el && el.tagName !== 'TABLE') {
            // <p>／<div> の中に table があればそれを使う
            if ((el.tagName === 'P' || el.tagName === 'DIV')
                && el.querySelector('table')) {
                el = el.querySelector('table');
                break;
                }
            el = el.nextElementSibling;
          }
          const table = (el && el.tagName === 'TABLE') ? el : null;
          if (!table) {
            console.warn('装備中テーブルが見つかりません:', text, h3);
            h3.remove();
            return;
          }
          // ★(2) テキストに応じて ID を振る
          if (text.includes('ネックレス')) {
            table.id = 'necklaceEquipped';
          } else if (text.includes('防具')) {
            table.id = 'armorEquipped';
          } else if (text.includes('武器')) {
            table.id = 'weaponEquipped';
          }
        // 見出し自体はもう不要なので削除
        h3.remove();
      });
    })();

    // --- 「アイテムバッグ」見出しの整理 ---
    (function replaceBagHeading(){
      const headings = Array.from(document.querySelectorAll('h1, h3'))
          .filter(el => el.textContent.trim().startsWith('アイテムバッグ'));
      if (headings.length < 2) return;
      const old = headings[1];
      const h2 = document.createElement('h2');
      h2.style.fontSize  = '1.5em';
      h2.style.marginTop = '1em';
      h2.innerHTML = '<span style="color:red;">&block;</span> 所持アイテム一覧';
      old.replaceWith(h2);
    })();

    // 〓〓〓〓〓〓 CSS 注入 〓〓〓〓〓〓

    const style = document.createElement('style');
      style.textContent = `
      /* --- Pタグのマージンをクリア --- */
      p {
        margin-top:    unset;
        margin-right:  unset;
        margin-bottom: unset;
        margin-left:   unset;
      }

      /* --- どんぐりバッグの画像を右寄せ --- */
      @media (min-width:800px) {
        img[src*="acorn-bag.jpg"] {
          float: right;
          margin: 0 0 1em 1em;
          max-width: 40%;
        }
      }

      /* --- ページ上の「全て分解する」ボタンにのみ適用 --- */
      form[action="https://donguri.5ch.net/recycleunlocked"] > button {
        display: block;
        margin: 8px auto;
        font-size: 1em;
        padding: 4px 8px;
      }

      /* --- 宝箱リンク用のリストレイアウト --- */
      ul#treasurebox {
        list-style: none;
        padding: 0;
        margin: 0 auto;
        display: flex;
        justify-content: center;
        gap: 1em;
        flex-wrap: wrap;
        font-size: 1.2em;
        font-weight: bold;
      }

      /* --- 装備中テーブルの幅とマージンを整形 --- */
      table#weaponEquipped,
      table#armorEquipped,
      table#necklaceEquipped {
        min-width: 100%;
        margin: 0px auto 12px 0px;
      }

      /* --- ソートインジケーター定義 --- */
      .sort-indicator,
      .sort-indicator-left {
        display: inline-block;
        margin: 0;
        padding: 0;
        transform-origin: center center;
        color: red;
        font-weight: bold;
      }
      /* ソートラベルの文字サイズ（インジケーター内） */
      .sort-label {
        font-size: 0.8em;
        vertical-align: middle;
      }

      /* --- 強制表示用：フィルターUI と バーガーメニュー --- */
      .filter-ui {
        display: flex !important;
        flex-direction: column !important;
        visibility: visible !important;
        opacity: 1 !important;
      }
      .donguri-burger-btn {
        display: flex !important;
      }

      /* --- カラーパレット呼び出しボックスの隙間除去（id 指定で限定適用） --- */
      #dbe-prm-panel0-setcolor-cell-unlocked,
      #dbe-prm-panel0-setcolor-cell-locked {
        /* ブラウザ既定の余白を無効化 */
        appearance: none;
        -webkit-appearance: none;
        padding: 0;
      }
      /* WebKit の内側ラッパ余白を0に */
      #dbe-prm-panel0-setcolor-cell-unlocked::-webkit-color-swatch-wrapper,
      #dbe-prm-panel0-setcolor-cell-locked::-webkit-color-swatch-wrapper {
        padding: 0;
      }
      /* 内側スウォッチの枠を消して全面表示 */
      #dbe-prm-panel0-setcolor-cell-unlocked::-webkit-color-swatch,
      #dbe-prm-panel0-setcolor-cell-locked::-webkit-color-swatch {
        border: none;
      }
      #dbe-prm-panel0-setcolor-cell-unlocked::-moz-color-swatch, #dbe-prm-panel0-setcolor-cell-locked::-moz-color-swatch { border: none; }


      `;
    document.head.appendChild(style);
    // --- CSS 注入 ここまで ---

    // 〓〓〓〓〓〓 ページソースの置換や削除 〓〓〓〓〓〓

    // --- 空の <p> を削除 ---
    document.querySelectorAll('p').forEach(p => {
        if (!p.textContent.trim() && p.children.length === 0) {
            p.remove();
        }
    });

    // --- 分解ボタンのラベル置換 ---
    document.querySelectorAll('form[action*="recycleunlocked"] button').forEach(btn => {
        if (btn.textContent.includes('ロックされていない武器防具を全て分解する')) {
            btn.textContent = 'ロックされていないアイテムを全て分解する';
        }
    });

    // 〓〓〓〓〓〓 宝箱リンクの置換 〓〓〓〓〓〓

    function replaceTreasureLinks(){
        const anchors = Array.from(document.querySelectorAll('h3>a'))
            .filter(a => a.getAttribute('href').endsWith('chest'));
        if (anchors.length === 0) return;
        const ul = document.createElement('ul');
        ul.id = 'treasurebox';
        ul.innerHTML = `
            <li><a href="https://donguri.5ch.net/chest">宝箱</a></li>
            <li><a href="https://donguri.5ch.net/battlechest">バトル宝箱</a></li>
        `;
        const firstH3 = anchors[0].parentNode;
        firstH3.parentNode.insertBefore(ul, firstH3);
        anchors.forEach(a => a.parentNode.remove());
    }

    // 〓〓〓〓〓〓 アイテム数サマリの挿入 〓〓〓〓〓〓

    function insertItemSummary(){
      // treasurebox がなければ necklaceTitle を代替に
      const ref = document.getElementById('treasurebox')
                || document.getElementById('necklaceTitle');
      if (!ref) return;

      function countRows(id) {
        const table = document.getElementById(id);
        return table?.tBodies[0]?.rows.length || 0;
      }

      const n   = countRows('necklaceTable'),
            w   = countRows('weaponTable'),
            a   = countRows('armorTable'),
            tot = n + w + a;

      const info = document.createElement('div');
      info.style.marginTop = '1em';
      info.innerHTML = `
        <div style="font-size:1.1em;font-weight:bold">所持アイテム総数：${tot}</div>
        <div style="font-size:1em">（ネックレス：${n}個／武器：${w}個／防具：${a}個）</div>
      `;
      ref.insertAdjacentElement('afterend', info);
    }

    // 〓〓〓〓〓〓 サーバー由来の h3/h4/h5 タグを div に置き換え 〓〓〓〓〓〓

    // ページ読み込み時に存在する h3/h4/h5 タグにマーカーを付与
    ['h3','h4','h5'].forEach(tag => {
        Array.from(document.getElementsByTagName(tag)).forEach(el => {
            el.setAttribute('data-donguri-original','true');
        });
    });
    // マーカー付き要素のみを div に置き換え
    const tagMap = {
        'H3': { size: '1.4em', bold: true,  margin: '6px' },
        'H4': { size: '1.2em', bold: false, margin: '4px' },
        'H5': { size: '1.1em', bold: false, margin: '4px' }
    };
    Object.entries(tagMap).forEach(([tag, { size, bold, margin }]) => {
        Array.from(document.getElementsByTagName(tag))
            .filter(el => el.getAttribute('data-donguri-original') === 'true')
            .forEach(el => {
                const d = document.createElement('div');
                d.innerHTML = el.innerHTML;
                d.style.fontSize   = size;
                d.style.margin     = margin;
                if (bold) d.style.fontWeight = 'bold';
                // 元の属性もコピー
                Array.from(el.attributes).forEach(a => d.setAttribute(a.name, a.value));
                el.replaceWith(d);
            });
    });

    // 〓〓〓〓〓〓 セル位置記憶＋自動スクロール 〓〓〓〓〓〓
    try {
      const id = sessionStorage.getItem(anchorKey);
      if (id) scrollToAnchorCell();
    } catch (_){ }

    // --- 関数呼び出し ---
    initLockToggle();
    tableIds.forEach(processTable);
    initRecycle();
    initMenu();
    initBulkRecycle();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

  // --- 「戻る」復帰（bfcache）等でUIを再同期 ---
  window.addEventListener('pageshow', (e)=>{
    if (e.persisted || (performance.getEntriesByType('navigation')[0]?.type === 'back_forward')) {
      syncMenuFromStorage();
      applyCellColors();
    }
  });
  document.addEventListener('visibilitychange', ()=>{
    if (document.visibilityState === 'visible') { syncMenuFromStorage(); applyCellColors(); }
  });

  // 〓〓〓〓〓〓 バーガーメニュー 〓〓〓〓〓〓
  // --- UI初期化 ---
  function initMenu(){
    // 二重初期化ガード（戻る復帰時や二重実行対策）
    if (document.getElementById('enhancer-panel-0')) return;
    // バーガーメニューボタン
    const btn = document.createElement('div');
    btn.classList.add('donguri-burger-btn');
    Object.assign(btn.style,{position:'fixed',bottom:'0',left:'0',width:'50px',height:'50px',padding:'0',boxSizing:'border-box',border:'2px solid #006600',borderRadius:'8px',backgroundColor:'#009966',color:'#FFF',display:'flex',justifyContent:'center',alignItems:'center',fontSize:'2em',fontWeight:'bold',cursor:'pointer',zIndex:'999999'});
    btn.textContent='?'; document.body.appendChild(btn);
    // サブウインドウ
    const menu = document.createElement('div');
    menu.id = 'enhancer-panel-0';
    // ── panel-0 を 4 区分に分割 ─────────────────────────────
    const secSettings  = document.createElement('div');  secSettings.id  = 'dbe-panel0-Settings';
    const secRecycle   = document.createElement('div');  secRecycle.id   = 'dbe-panel0-Recycle';
    const secNav       = document.createElement('div');  secNav.id       = 'dbe-panel0-Navigation';
    const secAbout     = document.createElement('div');  secAbout.id     = 'dbe-panel0-About';
    // 適度な余白（必要なければ削除可）
    [secSettings,secRecycle,secNav,secAbout].forEach(s=>{ s.style.margin='8px 0'; });

    Object.assign(menu.style,{
      position:'fixed',bottom:'50px',left:'0',maxWidth:'450px',
      border:'3px solid #006600',borderRadius:'8px',
      padding:'8px 8px 4px 8px',backgroundColor:'#F6FFFF',display:'none',
      flexDirection:'column',alignItems:'flex-start',zIndex:'999998',
      maxHeight:'80vh',overflowY:'auto'
    });
    const spacer = ()=>{ const sp=document.createElement('div'); sp.style.height='0.5em'; return sp; };

    // --- 基準文字サイズ（ページ全体） ---
    const fsRow = document.createElement('div');
    fsRow.style.display='flex'; fsRow.style.gap='0'; fsRow.style.alignItems='center'; fsRow.style.margin='0 0 4px 0';
    const fsLabel = document.createElement('span'); fsLabel.textContent='基準文字サイズ：';
    const fsName  = 'dbe-fontsize';
    const fsOptions = ['16px','14px','12px'];
    const fsContainer = document.createElement('div'); fsContainer.style.display='flex'; fsContainer.style.gap='12px';
    const currentFS = readStr('baseFontSize');
    fsOptions.forEach(val=>{
      const lab = document.createElement('label'); lab.style.display='flex'; lab.style.alignItems='center'; lab.style.gap='0px';
      const r = document.createElement('input'); r.type='radio'; r.name=fsName; r.value=val; r.id=`dbe-prm-panel0-fontsize-${val}`;
      r.checked = (currentFS===val);
      r.addEventListener('change', ()=>{
        if (r.checked){ writeStr('baseFontSize', val); applyBaseFontSize(); }
      });
      lab.append(r, document.createTextNode(val));
      fsContainer.appendChild(lab);
    });
    fsRow.append(fsLabel, fsContainer);
    secSettings.appendChild(fsRow);

    // --- カラー設定：[錠]セル・[解錠]セル背景色 ---    // [錠]セルの背景色
    const unlockedInput = document.createElement('input');
    unlockedInput.type  = 'color';
    // カラーパレット呼び出しボックスの大きさ
    unlockedInput.style.border  = '2px solid #666666';
    unlockedInput.style.width  = '27px';
    unlockedInput.style.height = '27px';
    unlockedInput.style.margin = '2px 0 2px 0';
    unlockedInput.style.padding = '0';
    // 注: ボックス内の黒い隙間は上のCSSで除去
    unlockedInput.id    = 'dbe-prm-panel0-setcolor-cell-unlocked';
    unlockedInput.value = readStr('unlockedColor');
    const unlockedText  = document.createElement('input');
    unlockedText.type   = 'text';
    unlockedText.id     = 'dbe-prm-panel0-text-unlocked';
    // 表示は常に大文字に
    unlockedText.style.textTransform = 'uppercase';
    unlockedText.value  = unlockedInput.value;
    // ラベル
    const unlockedLabelSpan = document.createElement('span'); unlockedLabelSpan.textContent = '［錠］の背景色：';
    unlockedText.style.width  = '5em';
    unlockedText.style.margin = '0 4px 2px 0';
    unlockedText.style.padding = '2px 8px';
    // 入力即時反映
    // HEX 正規化（#RRGGBB へ統一、返せない場合は null）
    function normalizeHex(v){
      if(!v) return null;
      v = String(v).trim();
      if(/^#?[0-9a-fA-F]{6}$/.test(v)){
        if(v[0] !== '#') v = '#' + v;
        return v.toUpperCase();
      }
      return null;
    }

    // カラーパレット側の変更 → テキストへ反映（大文字化）
    unlockedInput.addEventListener('input', ()=>{
      const hex = normalizeHex(unlockedInput.value) || unlockedInput.value;
      unlockedText.value = hex.toUpperCase();
      writeStr('unlockedColor', unlockedText.value);
      applyCellColors();
    });
    // テキスト側の変更 → カラーパレットへ反映（確定時に正規化）
    unlockedText.addEventListener('change', ()=>{
      const hex = normalizeHex(unlockedText.value);
      if(hex){
        unlockedText.value  = hex;
        unlockedInput.value = hex;
        writeStr('unlockedColor', hex);
        applyCellColors();
      } else {
        // 入力が不正なら直前値へ戻す
        unlockedText.value = normalizeHex(unlockedInput.value) || unlockedInput.value.toUpperCase();
      }
    });

    // 1行にまとめて Settings へ
    const rowUnlocked = document.createElement('div');
    rowUnlocked.style.display='flex'; rowUnlocked.style.gap='8px'; rowUnlocked.style.margin='0 0 4px 0'; rowUnlocked.style.alignItems='center';
    rowUnlocked.append(unlockedLabelSpan, unlockedInput, unlockedText);
    secSettings.appendChild(rowUnlocked);

    // [解錠]セルの背景色
    const lockedInput = document.createElement('input');
    lockedInput.type  = 'color';
    // カラーパレット呼び出しボックスの大きさ
    lockedInput.style.border  = '2px solid #666666';
    lockedInput.style.width  = '27px';
    lockedInput.style.height = '27px';
    lockedInput.style.margin = '2px 0 2px 0';
    lockedInput.style.padding = '0';
    // 注: ボックス内の黒い隙間は上のCSSで除去
    lockedInput.id    = 'dbe-prm-panel0-setcolor-cell-locked';
    lockedInput.value = readStr('lockedColor');
    const lockedText  = document.createElement('input');
    lockedText.type   = 'text';
    lockedText.id     = 'dbe-prm-panel0-text-locked';
    lockedText.value  = lockedInput.value;
    // 表示は常に大文字に
    lockedText.style.textTransform = 'uppercase';
    // ラベル
    const lockedLabelSpan = document.createElement('span'); lockedLabelSpan.textContent = '［解錠］の背景色：';
    lockedText.style.width  = '5em';
    lockedText.style.margin = '0 4px 2px 0';
    lockedText.style.padding = '2px 8px';

    // （参考）既存の applyCellColors／syncMenuFromStorage でも保存値はそのまま大文字で扱われます

    // カラーパレット側の変更 → テキストへ反映（大文字化）
    lockedInput.addEventListener('input', ()=>{
      const hex = normalizeHex(lockedInput.value) || lockedInput.value;
      lockedText.value = hex.toUpperCase();
      writeStr('lockedColor', lockedText.value);
      applyCellColors();
    });
   // テキスト側の変更 → カラーパレットへ反映（確定時に正規化）
    lockedText.addEventListener('change', ()=>{
      const hex = normalizeHex(lockedText.value);
      if(hex){
        lockedText.value  = hex;
        lockedInput.value = hex;
        writeStr('lockedColor', hex);
        applyCellColors();
      } else {
        // 入力が不正なら直前値へ戻す
        lockedText.value = normalizeHex(lockedInput.value) || lockedInput.value.toUpperCase();
      }
    });

    // 1行にまとめて Settings へ
    const rowLocked = document.createElement('div');
    rowLocked.style.display='flex'; rowLocked.style.gap='8px'; rowLocked.style.margin='0 0 4px 0'; rowLocked.style.alignItems='center';
    rowLocked.append(lockedLabelSpan, lockedInput, lockedText);
    secSettings.appendChild(rowLocked);

    // --- ネックレス「増減」列表示設定（未設定時はOFF＝false） ---
    const showDeltaCk  = document.createElement('input'); showDeltaCk.type = 'checkbox';
    showDeltaCk.id     = 'dbe-prm-panel0-check-display-necClm-Dlta';
    showDeltaCk.checked = readBool('showDelta');
    showDeltaCk.addEventListener('change', ()=>{
      const show = showDeltaCk.checked;
      toggleDeltaColumn(show);
      writeBool('showDelta', show);
    });
    const rowDelta = document.createElement('label');
    rowDelta.style.display='flex'; rowDelta.style.gap='8px'; rowDelta.style.alignItems='center';
    rowDelta.append(showDeltaCk, document.createTextNode('ネックレスに「増減」列を表示する'));
    secSettings.appendChild(rowDelta);
    // 初期表示：前回の設定を反映
    toggleDeltaColumn(showDeltaCk.checked);

    // --- ネックレス、武器、防具の装備種とクラスを隠す ---
    const cbNameSub = document.createElement('input'); cbNameSub.type='checkbox';
    cbNameSub.id = 'dbe-prm-panel0-check-hide-NameSub';
    cbNameSub.checked = readBool('hideKindClass');
    // 初期適用
    toggleNameSubLine(cbNameSub.checked);
    cbNameSub.addEventListener('change', ()=>{
      writeBool('hideKindClass', cbNameSub.checked);
      toggleNameSubLine(cbNameSub.checked);
    });
    const rowHideNameSub = document.createElement('label');
    rowHideNameSub.style.display='flex'; rowHideNameSub.style.gap='8px'; rowHideNameSub.style.alignItems='center';
    rowHideNameSub.append(cbNameSub, document.createTextNode('ネックレス、武器、防具の装備種とクラスを隠す'));
    secSettings.appendChild(rowHideNameSub);

    // --- ネックレス、武器、防具の「錠／解錠」列を隠す（分解列の一つ上に配置） ---
    const cbLockCol = document.createElement('input'); cbLockCol.type='checkbox';
    cbLockCol.id = 'dbe-prm-panel0-check-hide-Clm-Lock';
    cbLockCol.checked = readBool('hideLockCol'); // デフォルト OFF
    // 初期適用
    toggleLockColumn(cbLockCol.checked);
    cbLockCol.addEventListener('change', ()=>{
      writeBool('hideLockCol', cbLockCol.checked);
      toggleLockColumn(cbLockCol.checked);
    });
    const rowHideLock = document.createElement('label');
    rowHideLock.style.display='flex'; rowHideLock.style.gap='8px'; rowHideLock.style.alignItems='center';
    rowHideLock.append(cbLockCol, document.createTextNode('ネックレス、武器、防具の「錠／解錠」列を隠す'));
    // 「分解列を隠す」の直前に挿入
    secSettings.appendChild(rowHideLock);

    // --- ネックレス、武器、防具の「分解」列を隠す ---
    const cbg = document.createElement('input'); cbg.type='checkbox';
    cbg.id = 'dbe-prm-panel0-check-hide-Clm-Rycl';
    cbg.checked = readBool('hideRyclCol');    // 初期適用: 分解列
    if (cbg.checked) tableIds.forEach(id=> document.querySelectorAll(`.${columnIds[id]['分解']}`).forEach(el=>el.style.display='none'));
    cbg.addEventListener('change', ()=>{
      writeBool('hideRyclCol', cbg.checked);
      tableIds.forEach(id=> document.querySelectorAll(`.${columnIds[id]['分解']}`).forEach(el=>el.style.display=cbg.checked?'none':''));
    });
    const rowHideCol = document.createElement('label');
    rowHideCol.style.display='flex'; rowHideCol.style.gap='8px'; rowHideCol.style.alignItems='center';
    rowHideCol.append(cbg, document.createTextNode('ネックレス、武器、防具の「分解」列を隠す'));
    secSettings.appendChild(rowHideCol);

    // --- dbe-panel0-Settings 内の表示テキストだけ「ネックレス」を半角に統一（初期＆以降の追加にも追従） ---
    normalizeNecklaceLabelInSettings(secSettings);
    new MutationObserver((mutations)=>{
      for (const m of mutations){
        m.addedNodes && m.addedNodes.forEach(node=>{
          if (node.nodeType === Node.TEXT_NODE){
            if (node.nodeValue && node.nodeValue.includes('ネックレス')){
              node.nodeValue = node.nodeValue.replaceAll('ネックレス','ﾈｯｸﾚｽ');
            }
          } else if (node.nodeType === Node.ELEMENT_NODE){
            normalizeNecklaceLabelInSettings(node);
          }
        });
      }
    }).observe(secSettings, {childList:true, subtree:true});

    // --- ページの「全て分解する」ボタンを隠す ---
    const hideRecycleCk  = document.createElement('input'); hideRecycleCk.type='checkbox';
    hideRecycleCk.id = 'dbe-prm-panel0-check-hide-RyclUnLck';
    hideRecycleCk.checked = readBool('hideAllBtn');
    // 初期適用: 全分解ボタン
    if (hideRecycleCk.checked) document.querySelectorAll('button, a').forEach(el=>{ if (el.textContent==='ロックされていないアイテムを全て分解する' && !menu.contains(el)) el.style.display='none'; });
    hideRecycleCk.addEventListener('change', ()=>{
      writeBool('hideAllBtn', hideRecycleCk.checked);
      document.querySelectorAll('button, a').forEach(el=>{ if (el.textContent==='ロックされていないアイテムを全て分解する' && !menu.contains(el)) el.style.display=hideRecycleCk.checked?'none':''; });
    });
    const rowHideBtn = document.createElement('label');
    rowHideBtn.style.display='flex'; rowHideBtn.style.gap='8px'; rowHideBtn.style.alignItems='center';
    rowHideBtn.append(hideRecycleCk, document.createTextNode('ページの「全て分解する」ボタンを隠す'));
    secSettings.appendChild(rowHideBtn);

    // --- 分解アラート設定UI（Recycle セクションへ） ---
    const secRecycl_Button    = document.createElement('div');
    secRecycl_Button.style.cssText = 'margin:0px;padding:8px;border:1px solid #666;border-radius:8px';
    const secRecycl_title  = document.createElement('div');
    secRecycl_title.textContent = '「全て分解」まきこみアラート';
    secRecycl_title.style.cssText = 'margin:4px 0;padding:0;font-size:1.1em;font-weight:bold';
    // グレードチェックボックス
    const secRecycl_alert_grade   = document.createElement('div');
    secRecycl_alert_grade.style.cssText = 'display:flex;flex-wrap:wrap;gap:12px;margin:0 12px 0 16px';
    { const defs = {'プラチナ':'Pt','金':'Au','銀':'Ag','青銅':'CuSn','銅':'Cu'};
      for(const [label,val] of Object.entries(defs)){
        const ck = document.createElement('input'); ck.type  = 'checkbox'; ck.value = val; ck.id    = `alert-grade-${val}`;
        ck.checked = localStorage.getItem(ck.id) === 'true';
        const lb = document.createElement('label'); lb.append(ck, document.createTextNode(' '+label));
        secRecycl_alert_grade.appendChild(lb);
        ck.addEventListener('change', ()=>{ localStorage.setItem(ck.id, ck.checked); });
      }
    }
    secRecycl_Button.appendChild(secRecycl_alert_grade);
    // レアリティチェックボックス
    const secRecycl_alert_rarity = document.createElement('div');
    secRecycl_alert_rarity.style.cssText = 'display:flex;flex-wrap:wrap;gap:12px;margin:0 12px 0 16px';
    for(const rk of ['UR','SSR','SR','R','N']){
      const ck = document.createElement('input'); ck.type  = 'checkbox'; ck.value = rk; ck.id    = `alert-rarity-${rk}`;
      ck.checked = localStorage.getItem(ck.id) === 'true';
      const lb = document.createElement('label'); lb.append(ck, document.createTextNode(' '+rk)); secRecycl_alert_rarity.appendChild(lb);
      ck.addEventListener('change', ()=>{ localStorage.setItem(ck.id, ck.checked); });
    }
    secRecycl_Button.appendChild(secRecycl_alert_rarity);
    secRecycl_Button.appendChild(secRecycl_title);
    secRecycle.appendChild(secRecycl_Button);

    // --- 「全て分解する」ボタン（アラート枠の内側へ） ---
    const allForm=document.createElement('form');
    allForm.action='https://donguri.5ch.net/recycleunlocked'; allForm.method='POST';
    const allBtn=document.createElement('button');
    allBtn.type='submit';
    allBtn.textContent='ロックされていないアイテムを全て分解する';
    allBtn.style.cssText='fontSize:0.9em; padding:4px 8px; margin:12px 0 4px 0;';
    allForm.appendChild(allBtn);
    secRecycl_Button.appendChild(allForm);

    // --- ナビボタン → Navigation セクションへ ---
    const nav = document.createElement('div');
    nav.style.cssText = 'display:flex;gap:12px;align-items:center;margin:0;padding:0;';
    const navLabel = document.createElement('span'); navLabel.textContent = '移動:'; navLabel.style.cssText = 'font-size:1.2em;font-weight:bold'; nav.appendChild(navLabel);
    const topBtn = document.createElement('button'); topBtn.textContent='PageTOP'; topBtn.style.fontSize='0.9em'; topBtn.addEventListener('click', ()=>window.scrollTo({top:0,behavior:'smooth'})); nav.appendChild(topBtn);
    for(const o of [{text:'ネックレス',id:'necklaceTitle'},{text:'武器',id:'weaponTitle'},{text:'防具',id:'armorTitle'}]){
      const b = document.createElement('button'); b.textContent=o.text; b.style.fontSize='0.9em';
      b.addEventListener('click', ()=>{
        const t = document.getElementById(o.id);
        if (t) t.scrollIntoView({behavior:'smooth', block:'start'});
      });
      nav.appendChild(b);
    }
    secNav.appendChild(nav);

    const link = document.createElement('div'); link.style.fontSize='0.7em';
    link.innerHTML = `ver_${DBE_VERSION} customized by bb97c8d2　（<a id="donguriTransferLink" href="https://donguri.5ch.net/transfer" target="_blank">どんぐり寄付</a>）`;
    secAbout.appendChild(link);

    // 「どんぐり転送サービス」リンククリック時にフラグをセット
    const transferLink = link.querySelector('#donguriTransferLink');
    if (transferLink) {
      transferLink.addEventListener('click', () => {
        localStorage.setItem('donguriAutoTransfer', 'bb97c8d2');
      });
    }

    document.body.appendChild(menu);
    btn.addEventListener('click', ()=>{ menu.style.display = menu.style.display==='none' ? 'flex' : 'none'; });

    // サブウィンドウの枠外をクリックしたらサブウィンドウを閉じる
    document.addEventListener('click', e => {
      if (menu.style.display === 'flex' && !menu.contains(e.target) && e.target !== btn) {
        menu.style.display = 'none';
      }
    });

    // 4セクションをメニューに載せる
    menu.append(secSettings, secRecycle, secNav, secAbout);
    // ← 初期描画直後に一度同期（bfcache復帰直後でも堅牢に）
    syncMenuFromStorage();
  }

  // --- 名称セルの装備種＋クラス行（2行目）の表示/非表示を切替 ---
  //   クラスや style 文字列に依存せず、各テーブルの 1 列目の
  //   「2つ目の <span>（= 情報行）」と、その直前の <br> を対象とする。
  function toggleNameSubLine(hide) {
    ['necklaceTable','weaponTable','armorTable'].forEach(id => {
      const table = document.getElementById(id);
      if (!table) return;
      table.querySelectorAll('tbody > tr > td:first-child').forEach(cell => {
        if (!(cell && cell.querySelectorAll)) return;
        const spans = cell.querySelectorAll('span');
        const infoSpan = (spans.length >= 2) ? spans[1] : null; // 2行目：装備種＋クラス行
        if (infoSpan){
          infoSpan.style.display = hide ? 'none' : '';
          // 直前の <br> だけ切替（空行抑止）
          const prev = infoSpan.previousElementSibling;
          if (prev && prev.tagName === 'BR'){
            prev.style.display = hide ? 'none' : '';
          } else {
            // 後方互換：cell 内の先頭 <br> を対象
            const firstBr = cell.querySelector('br');
            if (firstBr) firstBr.style.display = hide ? 'none' : '';
          }
        }
      });
    });
  }

  // --- necklaceTableの増減列の表示/非表示を切替 ---
  function toggleDeltaColumn(show) {
    document.querySelectorAll(`.${columnIds['necklaceTable']['増減']}`)
      .forEach(el => el.style.display = show ? '' : 'none');
  }

  // --- 「錠／解錠」列の列インデックスを動的に検出 ---
  function findLockColumnIndex(table){
    try{
      const head = table.tHead && table.tHead.rows && table.tHead.rows[0];
      const body = table.tBodies && table.tBodies[0];
      if (!head || !body) return -1;
      // キャッシュ
      if (table.dataset.lockColIdx && table.dataset.lockColIdx !== 'NaN'){
        const cached = Number(table.dataset.lockColIdx);
        if (Number.isInteger(cached) && cached >= 0 && cached < head.cells.length) return cached;
      }
      const colCount = head.cells.length;
      const rows = Array.from(body.rows).slice(0, 80); // サンプル走査
      let bestIdx = -1, bestHit = 0;
      for (let c=0; c<colCount; c++){
        let hits = 0;
        for (const r of rows){
          const cell = r.cells[c]; if (!cell) continue;
          // 「解錠」「施錠」のリンクや表記を広めに判定
          if (cell.querySelector('a[href*="/unlock/"],a[href*="/lock/"]')) { hits++; continue; }
          const t = cell.textContent || '';
          if (/\[?\s*解錠\s*\]?/.test(t) || /\[?\s*施錠\s*\]?/.test(t)) hits++;
        }
        if (hits > bestHit){ bestHit = hits; bestIdx = c; }
      }
      if (bestIdx >= 0) table.dataset.lockColIdx = String(bestIdx);
      return bestIdx;
    }catch(_){ return -1; }
  }

  // --- 名称セル（1列目）に??を右寄せ表示／削除（「解錠」行のみ対象） ---
  function applyPadlockMarkers(show){
    ['necklaceTable','weaponTable','armorTable'].forEach(id=>{
      const table = document.getElementById(id); if (!table) return;
      const body  = table.tBodies && table.tBodies[0]; if (!body) return;
      const lockIdx = findLockColumnIndex(table); if (lockIdx < 0) return;
      Array.from(body.rows).forEach(row=>{
        const lockCell = row.cells[lockIdx]; if (!lockCell) return;
        const isLocked = !!lockCell.querySelector('a[href*="/unlock/"]') || /\b解錠\b/.test(lockCell.textContent||'');
        const nameCell = row.querySelector('td:first-child'); if (!nameCell) return;
        // 既存のマーカーを整理
        nameCell.querySelectorAll('.dbe-lock-emoji').forEach(el=>el.remove());
        if (show && isLocked){
          nameCell.style.position = nameCell.style.position || 'relative';
          const mark = document.createElement('span');
          mark.className = 'dbe-lock-emoji';
          mark.textContent = '??';
          mark.style.cssText = 'position:absolute; right:6px; top:2px; pointer-events:none; opacity:0.9;';
          nameCell.appendChild(mark);
        }
      });
    });
  }

  // --- 「錠／解錠」列の表示/非表示を切替（ヘッダー含む） ---
  function toggleLockColumn(hide){
    ['necklaceTable','weaponTable','armorTable'].forEach(id=>{
      const table = document.getElementById(id); if (!table) return;
      const head = table.tHead && table.tHead.rows && table.tHead.rows[0];
      const body = table.tBodies && table.tBodies[0];
      if (!head || !body) return;
      const idx = findLockColumnIndex(table);
      if (idx < 0) return;
      // ヘッダー
      const th = head.cells[idx]; if (th) th.style.display = hide ? 'none' : '';
      // ボディ
      Array.from(body.rows).forEach(r=>{
        const td = r.cells[idx]; if (td) td.style.display = hide ? 'none' : '';
      });
    });
    // マーカーの反映
    applyPadlockMarkers(hide);
  }

  // --- dbe-panel0-Settings 内だけで、表示テキストの「ネックレス」を半角「ﾈｯｸﾚｽ」に統一 ---
  function normalizeNecklaceLabelInSettings(container){
    if (!container) return;
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
    const targets = [];
    while (walker.nextNode()){
      const n = walker.currentNode;
      if (n.nodeValue && n.nodeValue.includes('ネックレス')) targets.push(n);
    }
    targets.forEach(n => {
      n.nodeValue = n.nodeValue.replaceAll('ネックレス', 'ﾈｯｸﾚｽ');
    });
  }

  function recordClickedCell(cell, table){
    let cellId = cell.id;
    if (!cellId) {
      const rows = Array.from(table.tBodies[0].rows);
      const rowIndex = rows.indexOf(cell.parentElement);
      const cellIndex = Array.prototype.indexOf.call(cell.parentElement.cells, cell);
      cellId = `${table.id}-r${rowIndex}-c${cellIndex}`;
      cell.id = cellId;
    }
    lastClickedCellId = cellId;
    sessionStorage.setItem(anchorKey, cellId);
  }

  function scrollToAnchorCell(){
    if (!lastClickedCellId) return;
    const el = document.getElementById(lastClickedCellId);
    if (el) {
      const r = el.getBoundingClientRect();
      const y = window.pageYOffset + r.top + r.height/2 - window.innerHeight/2;
      window.scrollTo({ top: y, behavior: 'auto' });
    }
    lastClickedCellId = null;
    sessionStorage.removeItem(anchorKey);
  }

  function showOverlay(text){
    let ov = document.getElementById(overlayId);
    if (!ov) {
      ov = document.createElement('div');
      ov.id = overlayId;
      Object.assign(ov.style, {
        position:'fixed',top:0,left:0,width:'100%',height:'100%',
        backgroundColor:'rgba(0,0,0,0.5)',color:'#fff',
        display:'flex',justifyContent:'center',alignItems:'center',
        fontSize:'1.5em',zIndex:9999
      });
      document.body.appendChild(ov);
    }
    ov.textContent = text;
    ov.style.display = 'flex';
    ov.addEventListener('click', hideOverlay, { once:true });
  }

  function hideOverlay(){
    const ov = document.getElementById(overlayId);
    if (ov) ov.style.display = 'none';
  }

  // --- [錠]/[解錠]セル背景色を適用 ---
  function applyCellColors(){
    const unlockedColor = readStr('unlockedColor');
    const lockedColor   = readStr('lockedColor');
    tableIds.forEach(id=>{
      const table = document.getElementById(id);
      if (!table?.tHead) return;
      // 「解」列インデックス
      const hdrs   = table.tHead.rows[0].cells;
      const lockIdx = Array.from(hdrs).findIndex(th=>th.classList.contains(columnIds[id]['解']));
      if (lockIdx < 0) return;
      Array.from(table.tBodies[0].rows).forEach(row=>{
        const cell = row.cells[lockIdx];
        // a[href*="/lock/"] があるなら「未ロック」→unlockedColor、それ以外を lockedColor
        const isUnlocked = !!cell.querySelector('a[href*="/lock/"]');
        const bg = isUnlocked ? unlockedColor : lockedColor;
        cell.style.backgroundColor = bg;
        // 明度計算して文字色を切り替え
        const r = parseInt(bg.slice(1,3),16), g = parseInt(bg.slice(3,5),16), b = parseInt(bg.slice(5,7),16);
        const lum = 0.299*r + 0.587*g + 0.114*b;
        const txt = lum > 186 ? '#FF0000' : '#FFFFFF';
        cell.style.color = txt;
        const a = cell.querySelector('a');
        if (a) a.style.color = txt;
      });
    });
  }

  // --- メニューUIを保存値から再同期 ---
  function syncMenuFromStorage(){
    const menu = document.getElementById('enhancer-panel-0');
    if (!menu) return;
    // 基準文字サイズ
    applyBaseFontSize();
    const fs = readStr('baseFontSize');
    menu.querySelectorAll('input[name="dbe-fontsize"]').forEach(r=>{ r.checked = (r.value === fs); });
    // 色
    const uc = readStr('unlockedColor'), lc = readStr('lockedColor');
    const uColor = menu.querySelector('#dbe-prm-panel0-setcolor-cell-unlocked');
    const uText  = menu.querySelector('#dbe-prm-panel0-text-unlocked');
    const lColor = menu.querySelector('#dbe-prm-panel0-setcolor-cell-locked');
    const lText  = menu.querySelector('#dbe-prm-panel0-text-locked');
    if (uColor) uColor.value = uc; if (uText) uText.value = uc;
    if (lColor) lColor.value = lc; if (lText) lText.value = lc;
    applyCellColors();
    // ネックレス増減列
    const showDelta = readBool('showDelta');
    const deltaCk = menu.querySelector('#dbe-prm-panel0-check-display-necClm-Dlta');
    if (deltaCk) deltaCk.checked = showDelta;
    toggleDeltaColumn(showDelta);
    // 分解列の非表示
    const hideRycl = readBool('hideRyclCol');
    const ryclCk = menu.querySelector('#dbe-prm-panel0-check-hide-Clm-Rycl');
    if (ryclCk) ryclCk.checked = hideRycl;
    tableIds.forEach(id=> document.querySelectorAll(`.${columnIds[id]['分解']}`).forEach(el=>el.style.display = hideRycl ? 'none' : ''));
    // 「全て分解する」ボタンの非表示
    const hideAll = readBool('hideAllBtn');
    const allCk = menu.querySelector('#dbe-prm-panel0-check-hide-RyclUnLck');
    if (allCk) allCk.checked = hideAll;
    document.querySelectorAll('button, a').forEach(el=>{
      if (el.textContent==='ロックされていないアイテムを全て分解する' && !menu.contains(el)) el.style.display = hideAll ? 'none' : '';
    });
    // まきこみアラート（チェック状態を保存値に合わせ直す）
    menu.querySelectorAll('input[id^="alert-grade-"], input[id^="alert-rarity-"]').forEach(el=>{
      el.checked = localStorage.getItem(el.id) === 'true';
    });
  }

  // --- 基準文字サイズ適用 ---
  function applyBaseFontSize(){
    const size = readStr('baseFontSize');
    document.documentElement.style.fontSize = size;
  }

  // --- 確認ダイアログを出す ---
  function showConfirm(message){
    return new Promise(resolve => {
      const existing = document.getElementById('donguriConfirmOverlay');
      if (existing) existing.remove();
      const ov = document.createElement('div');
      ov.id = 'donguriConfirmOverlay';
      Object.assign(ov.style, {
        position:'fixed',top:0,left:0,width:'100%',height:'100%',
        backgroundColor:'rgba(0,0,0,0.5)',
        display:'flex',justifyContent:'center',alignItems:'center',zIndex:10000
      });
      const box = document.createElement('div');
      Object.assign(box.style, {
        backgroundColor:'#fff',padding:'20px',borderRadius:'8px',
        border:'5px solid #FF6600',textAlign:'center',color:'#000',
        maxWidth:'80%',fontSize:'1.1em'
      });
      // 第一段落を引数で受け取る
      const p1 = document.createElement('p');
      p1.textContent = message;
      const p2 = document.createElement('p');
      p2.textContent = 'このまま分解を行いますか？';
      box.append(p1,p2);
      const btns = document.createElement('div'); btns.style.marginTop='16px';
      const ok = document.createElement('button');   ok.textContent='分解する'; ok.style.margin='10px';
      const no = document.createElement('button');   no.textContent='キャンセル'; no.style.margin='10px';
      btns.append(ok,no);
      box.appendChild(btns);
      ov.appendChild(box);
      document.body.appendChild(ov);
      ok.addEventListener('click', ()=>{ ov.remove(); resolve(true); });
      no.addEventListener('click', ()=>{ ov.remove(); resolve(false); });
    });
  }

  // --- 一括分解送信の保留＆確認機能 ---
  function initBulkRecycle(){
    const forms = document.querySelectorAll('form[action="https://donguri.5ch.net/recycleunlocked"][method="POST"]');
    forms.forEach(form=>{
      form.addEventListener('submit', async e=>{
        e.preventDefault();
        showOverlay('まとめて分解します…');
        // ユーザーがチェックしたグレード／レアリティを収集
        const selectedGrades    = Array.from(document.querySelectorAll('input[id^="alert-grade-"]:checked')).map(i=>i.value);
        const selectedRarities  = Array.from(document.querySelectorAll('input[id^="alert-rarity-"]:checked')).map(i=>i.value);
              const foundTypes = new Set();

         // テーブルを順に調べて
        for (const id of tableIds){
          const table = document.getElementById(id);
          if (!table?.tHead) continue;
          const hdrs = table.tHead.rows[0].cells;
          let lockIdx=-1,nameIdx=-1;
          for (let i=0;i<hdrs.length;i++){
            const t = hdrs[i].textContent.trim();
            if (t==='解')      lockIdx = i;
            if (t==='ネックレス' && id==='necklaceTable') nameIdx = i;
            if (t==='武器'     && id==='weaponTable')     nameIdx = i;
            if (t==='防具'     && id==='armorTable')      nameIdx = i;
          }
          if (lockIdx<0||nameIdx<0) continue;

          Array.from(table.tBodies[0].rows).forEach(row=>{
            // アンロック済みだけ対象
            if (!row.cells[lockIdx].querySelector('a[href*="/lock/"]')) return;
            const text = row.cells[nameIdx].textContent;
            // レアリティ
            selectedRarities.forEach(rk => {
              if (text.includes(rk)) foundTypes.add(rk);
            });
            // グレード
            selectedGrades.forEach(gd => {
              if (text.includes(gd)) foundTypes.add(gd);
            });
          });
        }

        // １つでもヒットしたら警告（ヒットしたグレードは日本語に置換）
        if (foundTypes.size > 0){
          const labels = Array.from(foundTypes)
            .map(type => gradeNames[type] || type)
            .join(', ');
          const ok = await showConfirm(`分解するアイテムに ${labels} が含まれています。`);
        if (!ok){
            hideOverlay();
            return;
        }
      }

      // 実行
      try {
        await fetch(form.action,{method:'POST'});
          location.reload();
        } catch{ hideOverlay(); }
      });
    });
  }

  // --- ロック/アンロック切替機能 ---
  function initLockToggle(){
    tableIds.forEach(id=>{
      const table = document.getElementById(id);
      if (!table || !table.tHead) return;
      const colMap = columnIds[id];
      const hdrs   = Array.from(table.tHead.rows[0].cells);
      let lockIdx=-1,ryclIdx=-1;
      hdrs.forEach((th,i)=>{
        const t = th.textContent.trim();
        if (!colMap[t]) return;
        th.classList.add(colMap[t]);
        if (t==='解') lockIdx=i;
        if (t==='分解') ryclIdx=i;
      });
      Array.from(table.tBodies[0].rows).forEach(row => {
        if (lockIdx >= 0) {
          const cell = row.cells[lockIdx];
          cell.classList.add(colMap['解']);
          const a = cell.querySelector('a');
          if (a) {
            if (a.href.includes('/lock/')) {
              cell.setAttribute('released', '');
            }
            else if (a.href.includes('/unlock/')) {
              cell.setAttribute('secured', '');
            }
          }
        }
        if (ryclIdx >= 0) {
          row.cells[ryclIdx].classList.add(colMap['分解']);
        }
      });
      // 初期色付け
      applyCellColors();
      // イベント
      table.addEventListener('click', async e=>{
        const a = e.target.closest('a[href*="/lock/"],a[href*="/unlock/"]');
        if (!a) return;
        const td = a.closest(`td.${colMap['解']}`);
        if (!td) return;
        e.preventDefault();
        showOverlay(a.href.includes('/unlock/') ? 'アンロックしています...' : 'ロックしています...');
        try {
          const [,op,itemId] = a.href.match(/\/(unlock|lock)\/(\d+)/) || [];
          const res = await fetch(a.href);
          const html = await res.text();
          const doc  = new DOMParser().parseFromString(html,'text/html');
          const newTable = doc.getElementById(id);
          let newLockIdx=-1,newRyclIdx=-1;
          Array.from(newTable.tHead.rows[0].cells).forEach((th,i)=>{
            if (th.textContent.trim()==='解') newLockIdx=i;
            if (th.textContent.trim()==='分解') newRyclIdx=i;
          });
          const targetA = Array.from(newTable.tBodies[0].rows)
                                .map(r=>r.cells[newLockIdx])
                                .find(c=>c.querySelector(`a[href*="/${itemId}"]`));
          const targetB = targetA?.closest('tr').cells[newRyclIdx] || null;
          td.innerHTML = targetA.innerHTML;
          td.closest('tr').querySelector(`td.${colMap['分解']}`).innerHTML = targetB?.innerHTML||'';
          // 再色付け
          applyCellColors();
        } catch{}
        finally{ hideOverlay(); }
      });
    });
  }

  // --- 分解機能改良 ---
  function initRecycle(){
    tableIds.forEach(id=>{
      const table = document.getElementById(id);
      if (!table) return;
      table.addEventListener('click', async e=>{
        const a = e.target.closest('a[href*="/recycle/"]');
        if (!a) return;
        e.preventDefault();
        const m = a.href.match(/\/recycle\/(\d+)/);
        if (!m) return;
        recycleTableId = id;
        recycleItemId  = m[1];
        showOverlay('分解しています...');
        try {
          const res = await fetch(a.href);
          const html = await res.text();
          const doc  = new DOMParser().parseFromString(html,'text/html');
          const newTable = doc.getElementById(recycleTableId);
          let found = false;
          if (newTable?.tBodies[0]){
            Array.from(newTable.tBodies[0].rows).forEach(row=>{
              if (row.querySelector(`a[href*="/recycle/${recycleItemId}"]`)) found = true;
            });
          }
          if (found){
            hideOverlay();
            location.reload();
          } else {
            const curr = document.getElementById(recycleTableId);
            if (curr?.tBodies[0]){
              Array.from(curr.tBodies[0].rows).forEach(row=>{
                if (row.querySelector(`a[href*="/recycle/${recycleItemId}"]`)) row.remove();
              });
            }
            hideOverlay();
          }
        } catch{ hideOverlay(); }
        recycleTableId = null;
        recycleItemId  = null;
      });
    });
  }

  // 〓〓〓〓〓〓 テーブル加工機能 〓〓〓〓〓〓

  function processTable(id){
    const table = document.getElementById(id);
    if (!table || !table.tHead) return;
    table.style.margin = '8px 0 24px';
    const colMap = columnIds[id];
    // タイトル挿入
    if (!document.getElementById(titleMap[id])){
      const h3 = document.createElement('h3');
      h3.id = titleMap[id];
      h3.textContent = labelMap[id];
      Object.assign(h3.style,{margin:'0',padding:'0'});
      table.insertAdjacentElement('beforebegin', h3);
    }
    const headerRow = table.tHead.rows[0];
    const hdrs = Array.from(headerRow.cells);
    // テーブルごとにソート関数初期化
    lastSortMap[id] = null;

    // ヘッダー整形
    hdrs.forEach(th=>{
      th.style.backgroundColor = '#F0F0F0';
      th.style.color           = '#000';
      th.style.cursor          = 'default';
      const cls = colMap[th.textContent.trim()];
      if (cls) th.classList.add(cls);
    });
    const idxMap = {};
    hdrs.forEach((th,i)=>{
      const t = th.textContent.trim();
      if (colMap[t]) idxMap[t] = i;
    });
    // --- 名称ヘッダー（武器/防具）に 6段階サイクルソートをワイヤリング ---
    wireNameColumnSort(table, id, idxMap, hdrs, headerRow);

    // --- 「解」列ヘッダークリックで4フェーズ3段ソート（解／ランク／マリモ） ---
    const lockIdx = idxMap['解'];
    if (lockIdx != null) {
      const th = hdrs[lockIdx];
      th.style.cursor = 'pointer';
      // テーブル別に管理するソートフェーズ
      let lockState = 0;  // 0→①, 1→②, 2→③, 3→④
      // 共通：マリモ列インデックス
      const mrimIdx = idxMap['マリモ'];
      // テーブル別：ランク／レアリティ列インデックス
      const nameIdx = id === 'necklaceTable'
        ? idxMap['ネックレス']
        : id === 'weaponTable'
        ? idxMap['武器']
        : idxMap['防具'];

      th.addEventListener('click', () => {
        const rows = Array.from(table.tBodies[0].rows);
        rows.sort((a, b) => {
          // 1) 解リンク順 (secrOrder)
          const aKey = a.cells[lockIdx].hasAttribute('secured') ? 'secured'
                      : a.cells[lockIdx].hasAttribute('released') ? 'released'
                      : null;
          const bKey = b.cells[lockIdx].hasAttribute('secured') ? 'secured'
                      : b.cells[lockIdx].hasAttribute('released') ? 'released'
                      : null;
          const aSec = secrOrder[aKey] ?? 0;
          const bSec = secrOrder[bKey] ?? 0;
          // 2) ランク or レアリティ
          const aRank = id === 'necklaceTable'
            ? (gradeOrder[(a.cells[nameIdx].textContent.match(/Pt|Au|Ag|CuSn|Cu/)||['Cu'])[0]] || 0)
            : (rarityOrder[(a.cells[nameIdx].textContent.match(/UR|SSR|SR|R|N/)||['N'])[0]] || 0);
          const bRank = id === 'necklaceTable'
            ? (gradeOrder[(b.cells[nameIdx].textContent.match(/Pt|Au|Ag|CuSn|Cu/)||['Cu'])[0]] || 0)
            : (rarityOrder[(b.cells[nameIdx].textContent.match(/UR|SSR|SR|R|N/)||['N'])[0]] || 0);
          // 3) マリモ値
          const aMr = parseInt(a.cells[mrimIdx].textContent.replace(/\D/g,''),10) || 0;
          const bMr = parseInt(b.cells[mrimIdx].textContent.replace(/\D/g,''),10) || 0;

          let diff = 0;
          switch (lockState) {
            // ① 解逆 → ランク正 → マリモ正
            case 0: diff = (bSec - aSec) || (aRank - bRank) || (aMr - bMr); break;
            // ② 解逆 → ランク逆 → マリモ逆
            case 1: diff = (bSec - aSec) || (bRank - aRank) || (bMr - aMr); break;
            // ③ 解正 → ランク正 → マリモ正
            case 2: diff = (aSec - bSec) || (aRank - bRank) || (aMr - bMr); break;
            // ④ 解正 → ランク逆 → マリモ逆
            case 3: diff = (aSec - bSec) || (bRank - aRank) || (bMr - aMr); break;
          }
          return diff;
        });
        // 行を再描画
        rows.forEach(r => table.tBodies[0].appendChild(r));
        // 矢印表示：①②は右、③④は左
        const arrow = (lockState % 2 === 0) ? '?' : '?';
        const pos   = (lockState < 2) ? 'right' : 'left';
        updateSortIndicator(th, arrow, pos);
        // 次フェーズへ
        lockState = (lockState + 1) % 4;
        scrollToAnchorCell();
      });
    }

    // 〓〓〓〓〓〓 necklaceTable 固有 加工機能 〓〓〓〓〓〓

    // 増減列追加＆フィルターUI
    if (id==='necklaceTable'){
      // --- 安全な挿入位置の決定（'属性' が見つからない場合は末尾に追加） ---
      const attrIdxByMap = Number.isInteger(idxMap['属性']) ? idxMap['属性'] : -1;
      const attrIdxByText = (() => {
        const hdrCells = Array.from(headerRow.cells);
        return hdrCells.findIndex(th => (th.textContent||'').trim() === '属性');
      })();
      const attrIdx = (attrIdxByMap >= 0 ? attrIdxByMap : (attrIdxByText >= 0 ? attrIdxByText : headerRow.cells.length - 1));
      const pos = Math.max(0, Math.min(headerRow.cells.length, attrIdx + 1));

      // --- 列クラス名（未定義対策のフォールバック） ---
      const deltaColClass = (columnIds && columnIds.necklaceTable && columnIds.necklaceTable['増減']) ? columnIds.necklaceTable['増減'] : 'neckClm-Delta';

      // 増減列ヘッダー
      const dTh = document.createElement('th');
      dTh.classList.add(deltaColClass);
      dTh.textContent='増減';
      Object.assign(dTh.style,{backgroundColor:'#F0F0F0',color:'#000',textAlign:'center',cursor:'pointer'});
      const thRef = headerRow.cells[pos] || null;
      thRef ? headerRow.insertBefore(dTh, thRef) : headerRow.appendChild(dTh);

      // --- キーワード配列（未定義時のフォールバック） ---
      const _buff = (typeof buffKeywords!=='undefined' && Array.isArray(buffKeywords)) ? buffKeywords
                    : ['攻撃','防御','体力','命中','回避','会心','速度','与ダメ','被ダメ軽減','強化','確率'];
      const _debuff = (typeof debuffKeywords!=='undefined' && Array.isArray(debuffKeywords)) ? debuffKeywords
                    : ['攻撃低下','防御低下','体力低下','命中低下','回避低下','会心低下','速度低下','被ダメ増加','弱体'];

      // 各行に計算セル
      Array.from(table.tBodies[0].rows).forEach(row=>{
        const td = document.createElement('td');
        td.classList.add(deltaColClass);
        td.style.textAlign='center';
        const tdRef = row.cells[pos] || null;
        tdRef ? row.insertBefore(td, tdRef) : row.appendChild(td);
        let tot = 0;
        const attrCell = row.cells[attrIdx];
        if (attrCell){
          attrCell.querySelectorAll('li').forEach(li=>{
            const m = (li.textContent||'').trim().match(/(\d+)%\s*(.+)$/);
            if (!m) return;
            const v = +m[1], k = m[2].trim();
            tot += _buff.includes(k) ? v : (_debuff.includes(k) ? -v : 0);
          });
        }
        td.textContent = tot>0? ('△'+tot) : (tot<0? ('▼'+Math.abs(tot)) : '0');
      });

      // --- ソート（△はプラス、▼はマイナス）＋ インジケーター表示 ---
      // ascNum=true：逆順（tot 大→小）、ascNum=false：正順（tot 小→大）
      let ascNum = true;
      // ネックレス「増減」列の最後のソート方向を記憶（true=逆順(?), false=正順(?)）
      let necklaceLastSortDirection = null;
      const sortByDelta = (useAsc) => {
        const rows = Array.from(table.tBodies[0].rows);
        rows.sort((a, b) => {
          const txtA = (a.cells[pos]?.textContent||'').trim();
          const txtB = (b.cells[pos]?.textContent||'').trim();
          const va = txtA.startsWith('△') ? parseInt(txtA.slice(1),10)
                  : txtA.startsWith('▼') ? -parseInt(txtA.slice(1),10) : 0;
          const vb = txtB.startsWith('△') ? parseInt(txtB.slice(1),10)
                  : txtB.startsWith('▼') ? -parseInt(txtB.slice(1),10) : 0;
          return useAsc ? (vb - va) : (va - vb);
        });
        rows.forEach(r => table.tBodies[0].appendChild(r));
        // インジケーター更新（このヘッダー行内の既存を除去してから付与）
        (headerRow.closest('tr')||headerRow).querySelectorAll('.sort-indicator, .sort-indicator-left').forEach(el => el.remove());
        updateSortIndicator(dTh, useAsc ? '?' : '?', 'right');
        scrollToAnchorCell();
      };

      dTh.addEventListener('click', () => {
        // 現在のクリックで適用される方向でソートし、記憶
        sortByDelta(ascNum);
        necklaceLastSortDirection = ascNum;
        // 再適用用として lastSortMap に登録
        lastSortMap[id] = () => {
          if (necklaceLastSortDirection == null) return;
          sortByDelta(necklaceLastSortDirection);
        };
        // 次回クリックは反転
        ascNum = !ascNum;
      });

      // --- フィルター UI ---
      const sc=document.createElement('div');
      sc.style.display='flex';
      sc.style.flexWrap='wrap';
      sc.style.gap='8px';
      sc.style.margin='0px';
      const chks=[];
      // ラベル集合：statusMap が未定義なら、テーブルから動的抽出
      const dynamicLabels = (()=> {
        const s=new Set();
        Array.from(table.tBodies[0].rows).forEach(r=>{
          const cell = r.cells[attrIdx];
          if (!cell) return;
          cell.querySelectorAll('li').forEach(li=>{
            const m = (li.textContent||'').trim().match(/(\d+)%\s*(.+)$/);
            if (m) s.add(m[2].trim());
          });
        });
        return Array.from(s);
      })();
      const labels = (typeof statusMap!=='undefined' && statusMap && typeof statusMap==='object')
                    ? Object.keys(statusMap) : dynamicLabels;
      labels.forEach(label=>{
        const lb=document.createElement('label');
        lb.style.fontSize='1.0em';
        const ck=document.createElement('input');
        ck.type='checkbox';
        ck.value=label;
        ck.checked=false;
        ck.addEventListener('change',applyFilter);
        chks.push(ck);
        lb.append(ck,document.createTextNode(' '+label));
        sc.appendChild(lb);
      });
      table.insertAdjacentElement('beforebegin',sc);

      const bd=document.createElement('div');
      bd.style.display='flex';
      bd.style.gap='8px';
      bd.style.margin='0px';
      [['全解除',()=>{chks.forEach(c=>c.checked=false);applyFilter();}],['再読込',()=>{chks.forEach(c=>c.checked=false);applyFilter();}]].forEach(([t,fn])=>{
        const b=document.createElement('button');
        b.textContent=t;
        Object.assign(b.style,{fontSize:'0.9em',padding:'4px 8px',margin:'10px'});
        b.addEventListener('click',fn);
        bd.appendChild(b);
      });
      sc.insertAdjacentElement('beforebegin',bd);

      function applyFilter(){
        const act=chks.filter(c=>c.checked).map(c=>c.value);
        Array.from(table.tBodies[0].rows).forEach(r=>{
          if(act.length===0){ r.style.display=''; return; }
          const txt=(r.cells[attrIdx]?.textContent)||'';
          r.style.display=act.every(a=>txt.includes(a))?'':'none';
        });
        scrollToAnchorCell();
        // フィルター後：最後に記憶したソートを再適用
        if (lastSortMap[id]) lastSortMap[id]();
      }
      applyFilter();
    }

// 〓〓〓〓〓〓 weaponTable 固有 〓〓〓〓〓〓

    // --- 武器固有：ATK列多段ソート＋インジケーター ---
    if (id === 'weaponTable') {
      const atkIdx = idxMap['ATK'];
      const mrimIdx = idxMap['マリモ'];
      const atkTh = headerRow.cells[atkIdx];
      // ATK列ソート用の状態を管理
      let atkState = 0;
      atkTh.style.cursor = 'pointer';
      atkTh.addEventListener('click', () => {
        const rows = Array.from(table.tBodies[0].rows);
        // 既存のインジケーターを全列から削除
        headerRow.querySelectorAll('.sort-indicator, .sort-indicator-left').forEach(el => el.remove());
        switch (atkState) {
          // (1) 最高ATK値による逆順
          case 0:
            rows.sort((a, b) =>
              parseInt(b.cells[atkIdx].textContent.split('~')[1]) - parseInt(a.cells[atkIdx].textContent.split('~')[1]) ||
              parseInt(b.cells[atkIdx].textContent.split('~')[0]) - parseInt(a.cells[atkIdx].textContent.split('~')[0]) ||
              parseInt(b.cells[mrimIdx].textContent) - parseInt(a.cells[mrimIdx].textContent)
            );
            updateSortIndicator(atkTh, '?', 'right');
            break;
          // (2) 最高ATK値による正順
          case 1:
            rows.sort((a, b) =>
              parseInt(a.cells[atkIdx].textContent.split('~')[1]) - parseInt(b.cells[atkIdx].textContent.split('~')[1]) ||
              parseInt(a.cells[atkIdx].textContent.split('~')[0]) - parseInt(b.cells[atkIdx].textContent.split('~')[0]) ||
              parseInt(a.cells[mrimIdx].textContent) - parseInt(b.cells[mrimIdx].textContent)
            );
            updateSortIndicator(atkTh, '?', 'right');
            break;
          // (3) 最低ATK値による逆順
          case 2:
            rows.sort((a, b) =>
              parseInt(b.cells[atkIdx].textContent.split('~')[0]) - parseInt(a.cells[atkIdx].textContent.split('~')[0]) ||
              parseInt(b.cells[atkIdx].textContent.split('~')[1]) - parseInt(a.cells[atkIdx].textContent.split('~')[1]) ||
              parseInt(b.cells[mrimIdx].textContent) - parseInt(a.cells[mrimIdx].textContent)
            );
            updateSortIndicator(atkTh, '?', 'left');
            break;
          // (4) 最低ATK値による正順
          case 3:
            rows.sort((a, b) =>
              parseInt(a.cells[atkIdx].textContent.split('~')[0]) - parseInt(b.cells[atkIdx].textContent.split('~')[0]) ||
              parseInt(a.cells[atkIdx].textContent.split('~')[1]) - parseInt(b.cells[atkIdx].textContent.split('~')[1]) ||
              parseInt(a.cells[mrimIdx].textContent) - parseInt(b.cells[mrimIdx].textContent)
            );
            updateSortIndicator(atkTh, '?', 'left');
            break;
        }
        rows.forEach(r => table.tBodies[0].appendChild(r));
        atkState = (atkState + 1) % 4;
        scrollToAnchorCell();
      });
    }

     // --- 武器固有：SPD列4段ソート＋インジケーター ---
    if (id === 'weaponTable') {
      const spdIdx   = idxMap['SPD'];
      const nameIdx  = idxMap['武器'];
      const elemIdx  = idxMap['ELEM'];
      const mrimIdx  = idxMap['マリモ'];
      const spdTh    = headerRow.cells[spdIdx];
      // ソート状態: false=①, true=②
      let spdState = false;
      spdTh.style.cursor = 'pointer';
      spdTh.addEventListener('click', () => {
        const rows = Array.from(table.tBodies[0].rows);
        // 既存のインジケーターを全体から削除
        headerRow.querySelectorAll('.sort-indicator, .sort-indicator-left').forEach(el => el.remove());
        rows.sort((a, b) => {
          // 1. レアリティ
          const ra = (a.cells[nameIdx].textContent.match(/UR|SSR|SR|R|N/) || ['N'])[0];
          const rb = (b.cells[nameIdx].textContent.match(/UR|SSR|SR|R|N/) || ['N'])[0];
          // 2. ELEMENT 属性
          const aElemText = a.cells[elemIdx].textContent.trim();
          const bElemText = b.cells[elemIdx].textContent.trim();
          const aAttr = aElemText.replace(/[0-9]/g, '') || 'なし';
          const bAttr = bElemText.replace(/[0-9]/g, '') || 'なし';
          // 3. SPD値
          const aSpd = parseInt(a.cells[spdIdx].textContent.trim(), 10) || 0;
          const bSpd = parseInt(b.cells[spdIdx].textContent.trim(), 10) || 0;
          // 4. マリモ値
          const aMr  = parseInt(a.cells[mrimIdx].textContent.replace(/\D/g, ''), 10) || 0;
          const bMr  = parseInt(b.cells[mrimIdx].textContent.replace(/\D/g, ''), 10) || 0;
          if (!spdState) {
            // ① レア正順 → ELEMENT正順 → SPD逆順 → マリモ逆順
            return (rarityOrder[ra] - rarityOrder[rb])
                  || (elemOrder[aAttr] - elemOrder[bAttr])
                  || (bSpd - aSpd)
                  || (bMr - aMr);
          } else {
            // ② レア逆順 → ELEMENT逆順 → SPD正順 → マリモ正順
            return (rarityOrder[rb] - rarityOrder[ra])
                  || (elemOrder[bAttr] - elemOrder[aAttr])
                  || (aSpd - bSpd)
                  || (aMr - bMr);
          }
        });
        rows.forEach(r => table.tBodies[0].appendChild(r));
        // インジケーター更新：①→?, ②→? を右隣に表示
        updateSortIndicator(spdTh, spdState ? '?' : '?', 'right');
        spdState = !spdState;
        scrollToAnchorCell();
      });
    }

    // --- 武器固有：CRIT列4段ソート＋インジケーター ---
    if (id === 'weaponTable') {
      const nameIdx  = idxMap['武器'];
      const elemIdx  = idxMap['ELEM'];
      const critIdx  = idxMap['CRIT'];
      const mrimIdx  = idxMap['マリモ'];
      const critTh   = headerRow.cells[critIdx];
      // ソート状態: false=①, true=②
      let critState = false;
      critTh.style.cursor = 'pointer';
      critTh.addEventListener('click', () => {
        const rows = Array.from(table.tBodies[0].rows);
        // 既存のインジケーターを全体から削除
        headerRow.querySelectorAll('.sort-indicator, .sort-indicator-left').forEach(el => el.remove());
        rows.sort((a, b) => {
          // 1. レアリティ
          const ra = (a.cells[nameIdx].textContent.match(/UR|SSR|SR|R|N/) || ['N'])[0];
          const rb = (b.cells[nameIdx].textContent.match(/UR|SSR|SR|R|N/) || ['N'])[0];
          // 2. ELEMENT
          const aAttr = (a.cells[elemIdx].textContent.replace(/[0-9]/g, '') || 'なし').trim();
          const bAttr = (b.cells[elemIdx].textContent.replace(/[0-9]/g, '') || 'なし').trim();
          // 3. CRIT値（%を除去）
          const aCrit = parseInt(a.cells[critIdx].textContent.replace(/\D/g, ''), 10) || 0;
          const bCrit = parseInt(b.cells[critIdx].textContent.replace(/\D/g, ''), 10) || 0;
          // 4. マリモ値
          const aMr   = parseInt(a.cells[mrimIdx].textContent.replace(/\D/g, ''), 10) || 0;
          const bMr   = parseInt(b.cells[mrimIdx].textContent.replace(/\D/g, ''), 10) || 0;
          if (!critState) {
            // ① レア正順 → ELEMENT正順 → CRIT逆順 → マリモ逆順
            return (rarityOrder[ra] - rarityOrder[rb])
                  || (elemOrder[aAttr] - elemOrder[bAttr])
                  || (bCrit - aCrit)
                  || (bMr - aMr);
          } else {
            // ② レア逆順 → ELEMENT逆順 → CRIT正順 → マリモ正順
            return (rarityOrder[rb] - rarityOrder[ra])
                  || (elemOrder[bAttr] - elemOrder[aAttr])
                  || (aCrit - bCrit)
                  || (aMr - bMr);
          }
        });
        // ソート済み行を再描画
        rows.forEach(r => table.tBodies[0].appendChild(r));
        // インジケーター更新：①→?, ②→? を右隣に表示
        updateSortIndicator(critTh, critState ? '?' : '?', 'right');
        critState = !critState;
        scrollToAnchorCell();
      });
    }

    // --- 武器固有：MOD列多段ソート＋インジケーター ---
    if (id === 'weaponTable') {
      const modIdx  = idxMap['MOD'];
      const elemIdx = idxMap['ELEM'];
      const mrimIdx = idxMap['マリモ'];
      const modTh   = headerRow.cells[modIdx];
      // ソートフェーズ: false=フェーズ①, true=フェーズ②
      let modState = false;
      modTh.style.cursor = 'pointer';
      modTh.addEventListener('click', () => {
        const rows = Array.from(table.tBodies[0].rows);
        // 既存のインジケーターを削除
        headerRow.querySelectorAll('.sort-indicator, .sort-indicator-left').forEach(el => el.remove());
        if (!modState) {
          // フェーズ①: MOD desc → Element(attr) asc → Element(val) desc → Marimo desc
          rows.sort((a, b) => {
            const aMod = parseInt(a.cells[modIdx].textContent.replace(/\D/g, ''), 10) || 0;
            const bMod = parseInt(b.cells[modIdx].textContent.replace(/\D/g, ''), 10) || 0;
            if (bMod !== aMod) return bMod - aMod;
            // Element 列から数値と属性を抽出
            const aText = a.cells[elemIdx].textContent.trim();
            const bText = b.cells[elemIdx].textContent.trim();
            const aVal  = parseInt(aText, 10) || 0;
            const bVal  = parseInt(bText, 10) || 0;
            const aAttr = aText.replace(/[\d]/g, '') || 'なし';
            const bAttr = bText.replace(/[\d]/g, '') || 'なし';
            if (elemOrder[aAttr] !== elemOrder[bAttr]) return elemOrder[aAttr] - elemOrder[bAttr];
            if (bVal !== aVal) return bVal - aVal;
            const aMrim = parseInt(a.cells[mrimIdx].textContent.replace(/\D/g, ''), 10) || 0;
            const bMrim = parseInt(b.cells[mrimIdx].textContent.replace(/\D/g, ''), 10) || 0;
            return bMrim - aMrim;
          });
          updateSortIndicator(modTh, '?', 'right');
        } else {
          // フェーズ②: MOD asc → Element(attr) desc → Element(val) asc → Marimo asc
          rows.sort((a, b) => {
            const aMod = parseInt(a.cells[modIdx].textContent.replace(/\D/g, ''), 10) || 0;
            const bMod = parseInt(b.cells[modIdx].textContent.replace(/\D/g, ''), 10) || 0;
            if (aMod !== bMod) return aMod - bMod;
            const aText = a.cells[elemIdx].textContent.trim();
            const bText = b.cells[elemIdx].textContent.trim();
            const aVal  = parseInt(aText, 10) || 0;
            const bVal  = parseInt(bText, 10) || 0;
            const aAttr = aText.replace(/[\d]/g, '') || 'なし';
            const bAttr = bText.replace(/[\d]/g, '') || 'なし';
            if (elemOrder[aAttr] !== elemOrder[bAttr]) return elemOrder[bAttr] - elemOrder[aAttr];
            if (aVal !== bVal) return aVal - bVal;
            const aMrim = parseInt(a.cells[mrimIdx].textContent.replace(/\D/g, ''), 10) || 0;
            const bMrim = parseInt(b.cells[mrimIdx].textContent.replace(/\D/g, ''), 10) || 0;
            return aMrim - bMrim;
          });
          updateSortIndicator(modTh, '?', 'right');
        }
        rows.forEach(r => table.tBodies[0].appendChild(r));
        modState = !modState;
        scrollToAnchorCell();
      });
    }

    // --- 武器固有：マリモ列ソート＋インジケーター ---
    if (id === 'weaponTable') {
      const rrimIdx = idxMap['マリモ'];
      const rrimTh  = headerRow.cells[rrimIdx];
      // マリモ列ソート用フラグ
      let rrimDesc = true;
      rrimTh.style.cursor = 'pointer';
      rrimTh.addEventListener('click', () => {
        const rows = Array.from(table.tBodies[0].rows);
        // 既存の矢印をクリア
        headerRow.querySelectorAll('.sort-indicator, .sort-indicator-left').forEach(el => el.remove());
        // 数値を抜き出してソート
        rows.sort((a, b) => {
          const aVal = parseInt(a.cells[rrimIdx].textContent.replace(/\D/g, ''), 10) || 0;
          const bVal = parseInt(b.cells[rrimIdx].textContent.replace(/\D/g, ''), 10) || 0;
          return rrimDesc ? bVal - aVal : aVal - bVal;
        });
        rows.forEach(r => table.tBodies[0].appendChild(r));
        // 矢印表示：右隣に?／?
        updateSortIndicator(rrimTh, rrimDesc ? '?' : '?', 'right');
        rrimDesc = !rrimDesc;
        scrollToAnchorCell();
      });
    }

    // 〓〓〓〓〓〓 armorTable 固有 〓〓〓〓〓〓

    // --- 防具固有：DEF列多段ソート＋インジケーター ---
    if (id === 'armorTable') {
      const defIdx = idxMap['DEF'];
      const mrimIdx = idxMap['マリモ'];
      const defTh = headerRow.cells[defIdx];
      // DEF列ソート用の状態を管理
      let defState = 0;
      defTh.style.cursor = 'pointer';
      defTh.addEventListener('click', () => {
        const rows = Array.from(table.tBodies[0].rows);
        // 既存のインジケーターを全列から削除
        headerRow.querySelectorAll('.sort-indicator, .sort-indicator-left').forEach(el => el.remove());
        switch (defState) {
          // (1) 最高DEF値による逆順
          case 0:
            rows.sort((a, b) =>
              parseInt(b.cells[defIdx].textContent.split('~')[1]) - parseInt(a.cells[defIdx].textContent.split('~')[1]) ||
              parseInt(b.cells[defIdx].textContent.split('~')[0]) - parseInt(a.cells[defIdx].textContent.split('~')[0]) ||
              parseInt(b.cells[mrimIdx].textContent) - parseInt(a.cells[mrimIdx].textContent)
            );
            updateSortIndicator(defTh, '?', 'right');
            break;
          // (2) 最高DEF値による正順
          case 1:
            rows.sort((a, b) =>
              parseInt(a.cells[defIdx].textContent.split('~')[1]) - parseInt(b.cells[defIdx].textContent.split('~')[1]) ||
              parseInt(a.cells[defIdx].textContent.split('~')[0]) - parseInt(b.cells[defIdx].textContent.split('~')[0]) ||
              parseInt(a.cells[mrimIdx].textContent) - parseInt(b.cells[mrimIdx].textContent)
            );
            updateSortIndicator(defTh, '?', 'right');
            break;
          // (3) 最低DEF値による逆順
          case 2:
            rows.sort((a, b) =>
              parseInt(b.cells[defIdx].textContent.split('~')[0]) - parseInt(a.cells[defIdx].textContent.split('~')[0]) ||
              parseInt(b.cells[defIdx].textContent.split('~')[1]) - parseInt(a.cells[defIdx].textContent.split('~')[1]) ||
              parseInt(b.cells[mrimIdx].textContent) - parseInt(a.cells[mrimIdx].textContent)
            );
            updateSortIndicator(defTh, '?', 'left');
            break;
          // (4) 最低DEF値による正順
          case 3:
            rows.sort((a, b) =>
              parseInt(a.cells[defIdx].textContent.split('~')[0]) - parseInt(b.cells[defIdx].textContent.split('~')[0]) ||
              parseInt(a.cells[defIdx].textContent.split('~')[1]) - parseInt(b.cells[defIdx].textContent.split('~')[1]) ||
              parseInt(a.cells[mrimIdx].textContent) - parseInt(b.cells[mrimIdx].textContent)
            );
            updateSortIndicator(defTh, '?', 'left');
            break;
        }
        rows.forEach(r => table.tBodies[0].appendChild(r));
        defState = (defState + 1) % 4;
        scrollToAnchorCell();
      });
    }

    // --- 防具固有：WT列4段ソート＋インジケーター ---
    if (id === 'armorTable') {
      const nameIdx = idxMap['防具'];
      const elemIdx = idxMap['ELEM'];
      const wgtIdx  = idxMap['WT.'];
      const mrimIdx = idxMap['マリモ'];
      const wgtTh   = headerRow.cells[wgtIdx];
      // ソート状態: false→①, true→②
      let wgtState = false;
      wgtTh.style.cursor = 'pointer';
      wgtTh.addEventListener('click', () => {
        const rows = Array.from(table.tBodies[0].rows);
        // 既存の矢印クリア
        headerRow.querySelectorAll('.sort-indicator, .sort-indicator-left').forEach(el => el.remove());
        rows.sort((a, b) => {
          // 1. レアリティ
          const ra = (a.cells[nameIdx].textContent.match(/UR|SSR|SR|R|N/) || ['N'])[0];
          const rb = (b.cells[nameIdx].textContent.match(/UR|SSR|SR|R|N/) || ['N'])[0];
          // 2. ELEMENT
          const aAttr = (a.cells[elemIdx].textContent.replace(/[0-9]/g, '') || 'なし').trim();
          const bAttr = (b.cells[elemIdx].textContent.replace(/[0-9]/g, '') || 'なし').trim();
          // 3. WT値
          const aW = parseFloat(a.cells[wgtIdx].textContent) || 0;
          const bW = parseFloat(b.cells[wgtIdx].textContent) || 0;
          // 4. マリモ値
          const aM = parseInt(a.cells[mrimIdx].textContent.replace(/\D/g, ''), 10) || 0;
          const bM = parseInt(b.cells[mrimIdx].textContent.replace(/\D/g, ''), 10) || 0;
          if (!wgtState) {
            // ① レア正順 → ELEMENT正順 → WT逆順 → マリモ逆順
            return (rarityOrder[ra] - rarityOrder[rb])
                  || (elemOrder[aAttr] - elemOrder[bAttr])
                  || (bW - aW)
                  || (bM - aM);
          } else {
            // ② レア逆順 → ELEMENT逆順 → WT正順 → マリモ正順
            return (rarityOrder[rb] - rarityOrder[ra])
                  || (elemOrder[bAttr] - elemOrder[aAttr])
                  || (aW - bW)
                  || (aM - bM);
          }
        });
        // ソート済み行を再描画
        rows.forEach(r => table.tBodies[0].appendChild(r));
        // インジケーター更新：①→?, ②→?
        updateSortIndicator(wgtTh, wgtState ? '?' : '?', 'right');
        wgtState = !wgtState;
        scrollToAnchorCell();
      });
    }

    // --- 防具固有：CRIT列4段ソート＋インジケーター ---
    if (id === 'armorTable') {
      const nameIdx  = idxMap['防具'];
      const elemIdx  = idxMap['ELEM'];
      const critIdx  = idxMap['CRIT'];
      const mrimIdx  = idxMap['マリモ'];
      const critTh   = headerRow.cells[critIdx];
      // ソート状態: false=①, true=②
      let critState = false;
      critTh.style.cursor = 'pointer';
      critTh.addEventListener('click', () => {
        const rows = Array.from(table.tBodies[0].rows);
        // 既存のインジケーターをクリア
        headerRow.querySelectorAll('.sort-indicator, .sort-indicator-left').forEach(el => el.remove());
        rows.sort((a, b) => {
          // 1. レアリティ
          const ra = (a.cells[nameIdx].textContent.match(/UR|SSR|SR|R|N/) || ['N'])[0];
          const rb = (b.cells[nameIdx].textContent.match(/UR|SSR|SR|R|N/) || ['N'])[0];
          // 2. ELEMENT
          const aAttr = (a.cells[elemIdx].textContent.replace(/[0-9]/g, '') || 'なし').trim();
          const bAttr = (b.cells[elemIdx].textContent.replace(/[0-9]/g, '') || 'なし').trim();
          // 3. CRIT値（%を除去）
          const aCrit = parseInt(a.cells[critIdx].textContent.replace(/\D/g, ''), 10) || 0;
          const bCrit = parseInt(b.cells[critIdx].textContent.replace(/\D/g, ''), 10) || 0;
          // 4. マリモ値
          const aMr   = parseInt(a.cells[mrimIdx].textContent.replace(/\D/g, ''), 10) || 0;
          const bMr   = parseInt(b.cells[mrimIdx].textContent.replace(/\D/g, ''), 10) || 0;
          if (!critState) {
            // ① レア正順 → ELEMENT正順 → CRIT逆順 → マリモ逆順
            return (rarityOrder[ra] - rarityOrder[rb])
                  || (elemOrder[aAttr] - elemOrder[bAttr])
                  || (bCrit - aCrit)
                  || (bMr - aMr);
          } else {
            // ② レア逆順 → ELEMENT逆順 → CRIT正順 → マリモ正順
            return (rarityOrder[rb] - rarityOrder[ra])
                  || (elemOrder[bAttr] - elemOrder[aAttr])
                  || (aCrit - bCrit)
                  || (aMr - bMr);
          }
        });
        // ソート済み行を再描画
        rows.forEach(r => table.tBodies[0].appendChild(r));
        // インジケーター更新：①→?, ②→?
        updateSortIndicator(critTh, critState ? '?' : '?', 'right');
        critState = !critState;
        scrollToAnchorCell();
      });
    }

    // --- 防具固有：MOD列（amrClm-Mod）4段ソート＋インジケーター ---
    if (id === 'armorTable') {
      const modTh    = headerRow.querySelector(`th.${columnIds['armorTable']['MOD']}`);
      const elemTh   = headerRow.querySelector(`th.${columnIds['armorTable']['ELEM']}`);
      const mrimTh   = headerRow.querySelector(`th.${columnIds['armorTable']['マリモ']}`);
      const modIdx   = Array.prototype.indexOf.call(headerRow.cells, modTh);
      const elemIdx  = Array.prototype.indexOf.call(headerRow.cells, elemTh);
      const mrimIdx  = Array.prototype.indexOf.call(headerRow.cells, mrimTh);
      let modState   = 0; // 0=【MOD↓→元素↑→元素値↓→マリモ↓】, 1=【MOD↑→元素↓→元素値↑→マリモ↑】
      modTh.style.cursor = 'pointer';
      modTh.addEventListener('click', () => {
        const rows = Array.from(table.tBodies[0].rows);
        // 既存の矢印クリア
        headerRow.querySelectorAll('.sort-indicator, .sort-indicator-left').forEach(el => el.remove());
        // 4段ソート: MOD値 → 元素 → 元素数値 → マリモ値
        rows.sort((a, b) => {
          // 1. MOD値
          const aMod = parseInt(a.cells[modIdx].textContent.replace(/\D/g, ''), 10) || 0;
          const bMod = parseInt(b.cells[modIdx].textContent.replace(/\D/g, ''), 10) || 0;
          let d = modState === 0 ? (bMod - aMod) : (aMod - bMod);
          if (d) return d;
          // 2. 元素 (elemOrder)
          const aElem = (a.cells[elemIdx].textContent.match(/[^\d]+$/) || [''])[0];
          const bElem = (b.cells[elemIdx].textContent.match(/[^\d]+$/) || [''])[0];
          d = modState === 0
            ? (elemOrder[aElem] - elemOrder[bElem])
            : (elemOrder[bElem] - elemOrder[aElem]);
          if (d) return d;
          // 3. 元素数値
          const aVal = parseInt(a.cells[elemIdx].textContent.replace(/[^\d]/g, ''), 10) || 0;
          const bVal = parseInt(b.cells[elemIdx].textContent.replace(/[^\d]/g, ''), 10) || 0;
          d = modState === 0 ? (bVal - aVal) : (aVal - bVal);
          if (d) return d;
          // 4. マリモ値
          const aM = parseInt(a.cells[mrimIdx].textContent.replace(/\D/g, ''), 10) || 0;
          const bM = parseInt(b.cells[mrimIdx].textContent.replace(/\D/g, ''), 10) || 0;
          return modState === 0 ? (bM - aM) : (aM - bM);
        });
        // ソート済み行を再描画
        rows.forEach(r => table.tBodies[0].appendChild(r));
        // インジケーター表示
        updateSortIndicator(modTh, modState === 0 ? '?' : '?', 'right');
        modState = (modState + 1) % 2;
        scrollToAnchorCell();
      });
    }

    // --- 防具固有：マリモ列ソート＋インジケーター ---
    if (id === 'armorTable') {
      const mrimTh  = headerRow.querySelector('th.amrClm-Mrim');
      const mrimIdx = Array.prototype.indexOf.call(headerRow.cells, mrimTh);
      // マリモ列ソート用フラグ
      let mrimDesc = true;
      mrimTh.style.cursor = 'pointer';
      mrimTh.addEventListener('click', () => {
        const rows = Array.from(table.tBodies[0].rows);
        headerRow.querySelectorAll('.sort-indicator, .sort-indicator-left').forEach(el => el.remove());
        rows.sort((a, b) => {
          const aVal = parseInt(a.cells[mrimIdx].textContent.replace(/\D/g, ''), 10) || 0;
          const bVal = parseInt(b.cells[mrimIdx].textContent.replace(/\D/g, ''), 10) || 0;
          return mrimDesc ? bVal - aVal : aVal - bVal;
        });
        rows.forEach(r => table.tBodies[0].appendChild(r));
        updateSortIndicator(mrimTh, mrimDesc ? '?' : '?', 'right');
        mrimDesc = !mrimDesc;
        scrollToAnchorCell();
      });
    }
  }

  // --- 名称ヘッダー用：6段階サイクルソートをワイヤリング（weapon/armor） ---
  wireNameColumnSort(table, id, idxMap, hdrs, headerRow);


  // 〓〓〓〓〓〓 weaponTable ＋ armorTable 固有 〓〓〓〓〓〓
  function wireNameColumnSort(table, id, idxMap, hdrs, headerRow){
    // ネックレス表は除外（個別名なし・別ロジックのため）
    if (id === 'necklaceTable') {
      return; // 既存のネックレス側ロジックに委ねる
    }

    // 武器・防具固有：レアリティ／属性フィルターUI（＋アイテムIDフィルター）
    if (id==='weaponTable'||id==='armorTable') {
      const ui=document.createElement('div');
      ui.className='filter-ui';
      ui.style.margin='0px';
      const r2=document.createElement('div');
      r2.style.marginTop='4px';
      [['全解除',()=>{setAll(false);applyFilter();applyColor();}],
        ['再読込',()=>location.reload()]].forEach(([txt,fn])=>{
        const b=document.createElement('button');
        b.textContent=txt;
        Object.assign(b.style,{fontSize:'0.9em',padding:'4px 8px',margin:'10px'});
        b.addEventListener('click',fn);
        r2.appendChild(b);
      });
      ui.appendChild(r2);

      // 〓〓〓 アイテムIDフィルターの行（《「全解除」「再読込」》と《Rarity》の間に挿入）〓〓〓
      const r2_5 = document.createElement('div');
      Object.assign(r2_5.style, { marginTop:'4px', display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' });
      const idLbl1 = document.createElement('span'); idLbl1.textContent = 'アイテムID：';
      const idNum  = document.createElement('input');
      idNum.type = 'number';
      idNum.id   = 'dbe-filterui-itemidfilter-threshold'; // 指定IDを付与（※ページ内に同IDが複数存在しうる点は仕様に従う）
      idNum.value = String(DEFAULT_ITEMIDFILTER_THRESHOLD);
      idNum.style.width = '10em';
      const idLbl2 = document.createElement('span'); idLbl2.textContent = '以上を抽出する';
      const idChk  = document.createElement('input'); idChk.type = 'checkbox'; idChk.checked = false;
      // 変更反映
      idChk.addEventListener('change', ()=>{ applyFilter(); });
      idNum.addEventListener('input',  ()=>{ if(idChk.checked) applyFilter(); });
      r2_5.append(idLbl1, idNum, idLbl2, idChk);
      ui.appendChild(r2_5);

      const r3=document.createElement('div');
      Object.assign(r3.style,{marginTop:'6px',display:'flex',alignItems:'center'});
      const s3=document.createElement('span'); s3.textContent='Rarity：'; s3.style.fontSize='1.2em';
      r3.appendChild(s3);
      const elm={};
      ['UR','SSR','SR','R','N'].forEach(rk=>{
        const lbl=document.createElement('label');
        lbl.style.margin='0 4px';
        const chk=document.createElement('input');
        chk.type='checkbox';
        chk.checked=false;
        chk.addEventListener('change',applyFilter);
        elm[rk]=chk;
        lbl.append(chk,document.createTextNode(' '+rk));
        r3.appendChild(lbl);
      });
      ui.appendChild(r3);

      const r4=document.createElement('div');
      Object.assign(r4.style,{marginTop:'6px',display:'flex',alignItems:'center'});
      const s4=document.createElement('span'); s4.textContent='Element：'; s4.style.fontSize='1.2em';
      r4.appendChild(s4);
      const rarObj={};
      Object.keys(elemColors).forEach(a=>{
        const lbl=document.createElement('label');
        lbl.style.margin='0 4px';
        const chk=document.createElement('input');
        chk.type='checkbox';
        chk.checked=false;
        chk.addEventListener('change',()=>{applyFilter();applyColor();});
        rarObj[a]=chk;
        lbl.append(chk,document.createTextNode(' '+a));
        r4.appendChild(lbl);
      });
      ui.appendChild(r4);

      table.insertAdjacentElement('beforebegin',ui);

      const elemCol = idxMap['ELEM'];
      // 以降の 6段階サイクルやメタ抽出で参照する名称列タイトルを明示
      const nameTitle = (id === 'weaponTable') ? '武器' : '防具';
      // 名称セル（レアリティ表記を内包するセル）の列インデックス
      const nameCol   = idxMap[nameTitle];
      const mrimCol   = idxMap['マリモ'];
      let ascMulti = true;

      function setAll(v){ Object.values(elm).forEach(x=>x.checked=v); Object.values(rarObj).forEach(x=>x.checked=v); }
      function applyColor(){ Array.from(table.tBodies[0].rows).forEach(r=>{ const v=r.cells[elemCol].textContent.replace(/[0-9]/g,'').trim()||'なし'; r.cells[elemCol].style.backgroundColor=elemColors[v]; }); }
      function applyFilter(){
        const selectedRarities = Object.keys(elm).filter(rk=>elm[rk].checked);
        const selectedElements = Object.keys(rarObj).filter(el=>rarObj[el].checked);
        // アイテムIDしきい値の取得（チェックON時のみ使用）
        // 仕様：weaponTable -> necClm-Equp 列、armorTable -> amrClm-Equp 列を参照
        // 実装：実セルから /equip/NNNNNN のリンクを直接抽出（列名変化に強い）
        const useIdFilter = !!idChk.checked;
        // UI から取得（見つからない場合は共通定義のデフォルトを使用）
        const uiInput = document.getElementById('dbe-filterui-itemidfilter-threshold');
        const idThreshold = (useIdFilter
          ? (parseInt(uiInput?.value ?? '', 10) || DEFAULT_ITEMIDFILTER_THRESHOLD)
          : null);

        Array.from(table.tBodies[0].rows).forEach(row=>{
          // 名称セルからレアリティを抽出
          const rt = (row.cells[nameCol].textContent.match(/UR|SSR|SR|R|N/)||['N'])[0];
          const e  = (row.cells[elemCol].textContent.replace(/[0-9]/g,'').trim()||'なし');
          const okR = selectedRarities.length === 0 || selectedRarities.includes(rt);
          const okE = selectedElements.length === 0 || selectedElements.includes(e);

          // アイテムIDフィルター：チェックON時のみ評価
          let okId = true;
          if (useIdFilter) {
            // 行内の equip リンクから数値IDを抽出（例：/equip/69366417）
            const equipA = row.querySelector('a[href*="/equip/"]');
            const href = equipA?.getAttribute('href') || '';
            const m = href.match(/\/equip\/(\d+)/);
            const itemId = m ? parseInt(m[1], 10) : NaN;
            // 数値化できない場合は「通す」、数値化できた場合のみしきい値と比較
            okId = Number.isNaN(itemId) ? true : (itemId >= idThreshold);
          }

          row.style.display = (okR && okE && okId) ? '' : 'none';        });
        // フィルター後：最後にソートされた列と方向を参照して再ソート
        if (lastSortedColumn !== null && lastSortAscending !== null) {
          if (typeof lastSortMap[id] === 'function') {
            lastSortMap[id]();
          }
        }
        applyColor();
        scrollToAnchorCell();
      }

      function multiSort(order){
        const rows=Array.from(table.tBodies[0].rows).filter(r=>r.style.display!=='none');
        rows.sort((a,b)=>{
          // 名称セルからレアリティを抽出
          const ra=(a.cells[nameCol].textContent.match(/UR|SSR|SR|R|N/)||['N'])[0];
          const rb=(b.cells[nameCol].textContent.match(/UR|SSR|SR|R|N/)||['N'])[0];
          let d=order?rarityOrder[ra]-rarityOrder[rb]:rarityOrder[rb]-rarityOrder[ra];
          if(d) return d;
          const ea=a.cells[elemCol].textContent.replace(/[0-9]/g,'').trim()||'なし';
          const eb=b.cells[elemCol].textContent.replace(/[0-9]/g,'').trim()||'なし';
          d=order?elemOrder[ea]-elemOrder[eb]:elemOrder[eb]-elemOrder[ea];
          if(d) return d;
          const ma=parseInt(a.cells[mrimCol].textContent.replace(/[^0-9]/g,''),10)||0;
          const mb=parseInt(b.cells[mrimCol].textContent.replace(/[^0-9]/g,''),10)||0;
          return order?mb-ma:ma-mb;
        });
        rows.forEach(r=>table.tBodies[0].appendChild(r));
      }

      // ELEM列ヘッダークリック時はフィルターではなくマルチソートのみ実行
      // ELEM列ソート用の状態を管理
      let elemState = 0; // 0=昇順, 1=降順
      hdrs[elemCol].style.cursor = 'pointer';
      hdrs[elemCol].addEventListener('click', () => {
        // 既存のインジケーターを全列から削除
        headerRow.querySelectorAll('.sort-indicator, .sort-indicator-left').forEach(el => el.remove());
        // ソート実行
        multiSort(elemState === 0);
        // インジケーター更新
        updateSortIndicator(hdrs[elemCol], elemState === 0 ? '?' : '?', 'right');
        // ソート状態を保存
        const lastState = elemState;
        lastSortMap[id] = () => {
          multiSort(lastState === 0);
          updateSortIndicator(hdrs[elemCol], lastState === 0 ? '?' : '?', 'right');
          applyColor(); scrollToAnchorCell();
        };
        elemState = elemState === 0 ? 1 : 0;
        applyColor();
        scrollToAnchorCell();
      });

      // --- ELEM列セルクリックによるフィルター→ソート→スクロール ---
      Array.from(table.tBodies[0].rows).forEach(row=>{
        const cell = row.cells[elemCol];
        cell.style.cursor = 'pointer';
        cell.addEventListener('click',()=>{
          // クリックしたセルを記憶
          recordClickedCell(cell, table);
          // クリックしたセルから「火,氷…なし」を抽出
          const clicked = (cell.textContent.match(/[^\d]+$/)||['なし'])[0];
          // 対応するチェックボックスだけONに
          Object.keys(rarObj).forEach(el=> rarObj[el].checked = (el === clicked));
          // フィルタ・色・ソート・スクロール
        applyFilter();
        applyColor();
        scrollToAnchorCell();
        });
      });

      // 〓〓〓〓〓〓 6 段階サイクル（①?⑥）【リニューアル版】 〓〓〓〓〓〓
      // 対象：weaponTable の wepClm-Name / armorTable の amrClm-Name
      // 名称・Rarity・Marimo・限定（未知/既知）・カナを用いた多段ソート

      const nameThOrig  = hdrs[idxMap[nameTitle]];
      const nameTh      = nameThOrig.cloneNode(true);
      nameThOrig.parentNode.replaceChild(nameTh, nameThOrig);
      nameTh.style.cursor = 'pointer';
      if (!table.dataset.nameSortPhase) table.dataset.nameSortPhase = '0';            // 次に実行する段階（0..5）
      if (!table.dataset.nameSortLastApplied) table.dataset.nameSortLastApplied = ''; // 直近適用の記憶

      // ヘッダー行・セルを都度取り直し（差し替えや再描画に強い）
      function getHeaderRowNow(){
        const th = (table.tHead && table.tHead.rows && table.tHead.rows[0] && table.tHead.rows[0].cells[idxMap[nameTitle]]) || nameTh;
        return (th && th.closest) ? th.closest('tr') : (table.tHead && table.tHead.rows && table.tHead.rows[0]) || headerRow;
      }
      function getNameThNow(){
        return (table.tHead && table.tHead.rows && table.tHead.rows[0] && table.tHead.rows[0].cells[idxMap[nameTitle]]) || nameTh;
      }

      // 各種レジストリ
      const metaCache  = new WeakMap();
      const kanaDict   = (id === 'weaponTable') ? weaponKana   : armorKana;    // Map<Name, Kana>
      const limitedSet = (id === 'weaponTable') ? limitedWeapon: limitedArmor; // Set<Name>
      const keyMap     = (id === 'weaponTable') ? weaponKeyToName : armorKeyToName; // Map<Key, CanonicalName>

      // 既知限定の判定（表示名 or 正規化キー→正規名）
      function isKnownLimited(name){
        if (limitedSet.has(name)) return true;
        const canonical = keyMap.get(makeKey(name));
        return canonical ? limitedSet.has(canonical) : false;
      }
      // 未知限定の検知：セル内にシリアル系表示があるが、レジストリに未登録
      function hasSerialLike(text){
        // 例: [54], [ 003 ], ( 1 of 20 ), （12／50）ほかを広めに吸収
        return /\[\s*\d+\s*\]|(?:\(\s*\d+\s*(?:of|\/|／)\s*\d+\s*\))|（\s*\d+\s*(?:of|\/|／)\s*\d+\s*）/i.test(text);
      }

      // フリガナ比較のための正規化
      function normalizeForFuri(s){
        if (!s) return '';
        // ひら→カナ、NFKC
        return [...s].map(ch => (ch >= '\u3041' && ch <= '\u3096') ? String.fromCharCode(ch.charCodeAt(0)+0x60) : ch).join('').normalize('NFKC');
      }
      // 文字カテゴリ: 0=記号, 1=数字, 2=英字, 3=日本語（カナ/かな/漢字）
      function charType(ch){
        const cp = ch.codePointAt(0);
        // 日本語（カタカナ/長音）
        if ((cp >= 0x30A0 && cp <= 0x30FF) || cp === 0x30FC) return 3;
        // ひらがな（normalize前後の保険）
        if (cp >= 0x3040 && cp <= 0x309F) return 3;
        // 漢字（CJK統合/拡張A/互換）
        if ((cp >= 0x4E00 && cp <= 0x9FFF) || (cp >= 0x3400 && cp <= 0x4DBF) || (cp >= 0xF900 && cp <= 0xFAFF)) return 3;
        // 記号
        if (cp === 0x30FB) return 0; // ・（中黒）
        // 数字（半角/全角）
        if ((cp >= 0x30 && cp <= 0x39) || (cp >= 0xFF10 && cp <= 0xFF19)) return 1;
        // 英字（半角/全角）
        if ((cp >= 0x41 && cp <= 0x5A) || (cp >= 0x61 && cp <= 0x7A) || (cp >= 0xFF21 && cp <= 0xFF3A) || (cp >= 0xFF41 && cp <= 0xFF5A)) return 2;
        // それ以外は記号扱い（絵文字など）
        return 0;
      }
      function readChunk(s, i, type){
        let j = i;
        if (type === 1){ // 数字
          while (j < s.length && charType(s[j]) === 1) j++;
          const str = s.slice(i,j);
          const num = Number.parseInt(str,10);
          return { next:j, type, str, num: Number.isNaN(num) ? 0 : num };
        }
        if (type === 2){ // 英字
          while (j < s.length && charType(s[j]) === 2) j++;
          return { next:j, type, str:s.slice(i,j) };
        }
        if (type === 3){ // カナ
          while (j < s.length && charType(s[j]) === 3) j++;
          return { next:j, type, str:s.slice(i,j) };
        }
        // 記号
        while (j < s.length && charType(s[j]) === 0) j++;
        return { next:j, type, str:s.slice(i,j) };
      }

      function compareChunksAsc(A,B,type){
        if (type === 1){ // 数字は数値比較→桁数→文字列
          if (A.num !== B.num) return A.num - B.num;
          if (A.str.length !== B.str.length) return A.str.length - B.str.length;
          return A.str.localeCompare(B.str, 'ja', {sensitivity:'base', numeric:true});
        }
        if (type === 2){ // 英字は辞書式
          return A.str.localeCompare(B.str, 'ja', {sensitivity:'base'});
        }
        if (type === 3){ // 日本語（カナ/かな/漢字）
          return A.str.localeCompare(B.str, 'ja', {sensitivity:'base', numeric:true});
        }
        // 記号はコード順
        return A.str < B.str ? -1 : (A.str > B.str ? 1 : 0);
      }
      function compareChunksDesc(A,B,type){
        if (type === 1){ // 数字は数値降順→桁数→文字列
          if (A.num !== B.num) return B.num - A.num;
          if (A.str.length !== B.str.length) return B.str.length - A.str.length;
          return B.str.localeCompare(A.str, 'ja', {sensitivity:'base', numeric:true});
        }
        if (type === 2){ // 英字は辞書式（逆順）
          return B.str.localeCompare(A.str, 'ja', {sensitivity:'base'});
        }
        if (type === 3){ // 日本語（逆順）
          return B.str.localeCompare(A.str, 'ja', {sensitivity:'base', numeric:true});
        }
        // 記号は安定のためコード順の逆
        return A.str > B.str ? -1 : (A.str < B.str ? 1 : 0);
      }

      // フリガナ優先度：正順= 記号 < 数字(昇) < 英字(昇) < カナ(昇)
      //                 逆順= カナ(降) < 英字(降) < 数字(降) < 記号
      function cmpFuri(a,b,asc){
        const sa = normalizeForFuri(a.kana ?? a.name);
        const sb = normalizeForFuri(b.kana ?? b.name);
        let ia=0, ib=0;
        const rankAsc  = [0,1,2,3];
        const rankDesc = [3,2,1,0];
        while (ia < sa.length && ib < sb.length){
          const ta = charType(sa[ia]);
          const tb = charType(sb[ib]);
          const ra = asc ? rankAsc[ta] : rankDesc[ta];
          const rb = asc ? rankAsc[tb] : rankDesc[tb];
          if (ra !== rb) return ra - rb;
          const ca = readChunk(sa, ia, ta);
          const cb = readChunk(sb, ib, tb);
          const d  = asc ? compareChunksAsc(ca,cb,ta) : compareChunksDesc(ca,cb,ta);
          if (d) return d;
          ia = ca.next; ib = cb.next;
        }
        return sa.length - sb.length;
      }

      // 行→メタ抽出
      function getMeta(row){
        if (metaCache.has(row)) return metaCache.get(row);
        const cell = row.cells[idxMap[nameTitle]];
        const firstSpan = cell.querySelector('span');
        const name = (firstSpan ? firstSpan.textContent : cell.textContent).trim();
        const raw  = cell.textContent;
        const rarity = (raw.match(/UR|SSR|SR|R|N/) || ['N'])[0];
        const marimo = parseInt(row.cells[mrimCol].textContent.replace(/\D/g,''),10) || 0;
        const kana   = (kanaDict instanceof Map) ? (kanaDict.get(name) ?? null) : null;
        const knownLimited = isKnownLimited(name);
        const unknownLimited = !knownLimited && hasSerialLike(raw);
        const hasKana = !!kana;
       // ③④：未知限定→既知限定→非限定 の優先
        const catLimitedAsc  = unknownLimited ? 0 : (knownLimited ? 1 : 2);
        // ⑤⑥：未定義(kana無)を上位に
        const catDefinedAsc  = hasKana ? 1 : 0; // 0=未定義,1=定義済み
        const obj = { row, name, raw, rarity, marimo, kana, knownLimited, unknownLimited, hasKana,
                      catLimitedAsc, catDefinedAsc };
        metaCache.set(row, obj);
        return obj;
      }

      // 単純比較ヘルパー
      function cmpRarity(a,b,asc){ const ra = rarityOrder[a.rarity] ?? 99; const rb = rarityOrder[b.rarity] ?? 99; return asc ? (ra-rb) : (rb-ra); }
      function cmpMarimo(a,b,highFirst){ return highFirst ? (b.marimo - a.marimo) : (a.marimo - b.marimo); }
      function cmpName(a,b,asc){ return asc ? a.name.localeCompare(b.name,'ja') : b.name.localeCompare(a.name,'ja'); }

      // ソート本体
      function applyCycleSort(phase){
        const body = table.tBodies[0];
        const rows = Array.from(body.rows);
        rows.sort((ra,rb)=>{
          const a = getMeta(ra), b = getMeta(rb);
          switch(phase){
            // ①【?Rarity】：rarity 正順 → marimo 逆順
            case 0:
              return cmpRarity(a,b,true) || cmpMarimo(a,b,true) || cmpFuri(a,b,true) || cmpName(a,b,true);
            // ②【?Rarity】：rarity 逆順 → marimo 正順
            case 1:
              return cmpRarity(a,b,false) || cmpMarimo(a,b,false) || cmpFuri(a,b,true) || cmpName(a,b,true);
            // ③【?限定】：未知限定→既知限定→非限定 → （各内：フリガナ正順。ただし未知限定は同名連結） → rarity 正順 → marimo 逆順
            case 2: {
              const c = a.catLimitedAsc - b.catLimitedAsc;
              if (c) return c;
              if (a.unknownLimited && b.unknownLimited){
                const g = cmpName(a,b,true);
                if (g) return g;
              } else {
                const g = cmpFuri(a,b,true);
                if (g) return g;
              }
              return cmpRarity(a,b,true) || cmpMarimo(a,b,true) || cmpName(a,b,true);
            }
            // ④【?限定】：カテゴリ順は据え置き（未知→既知→非）/ 各内の並びを逆（未知は同名 desc、他はフリガナ逆）→ rarity 逆順 → marimo 正順
            case 3: {
              const c = a.catLimitedAsc - b.catLimitedAsc;
              if (c) return c;
              if (a.unknownLimited && b.unknownLimited){
                const g = cmpName(a,b,false);
                if (g) return g;
              } else {
                const g = cmpFuri(a,b,false);
                if (g) return g;
              }
              return cmpRarity(a,b,false) || cmpMarimo(a,b,false) || cmpName(a,b,true);
            }
            // ⑤【?カナ】
            //   rarity 正順 → フリガナ正順 → （同名のみ）マリモ降順 → 名前
            case 4: {
              const r = cmpRarity(a,b,true);
              if (r) return r;
              const f = cmpFuri(a,b,true);
              if (f) return f;
                if (a.name === b.name) {
                const m = cmpMarimo(a,b,true);
                if (m) return m;
              }
              return cmpName(a,b,true);
            }
            // ⑥【?カナ】
            //   rarity 逆順 → フリガナ逆順 → （同名のみ）マリモ昇順 → 名前
            case 5: {
              const r = cmpRarity(a,b,false);
              if (r) return r;
              const f = cmpFuri(a,b,false);
              if (f) return f;
              if (a.name === b.name) {
                const m = cmpMarimo(a,b,false);
                if (m) return m;
              }
              return cmpName(a,b,true);
            }
          }
          return 0;
        });
        rows.forEach(r => body.appendChild(r));

        // ヘッダー右側にインジケーター（【?Rarity】等）
        const headerRowNow = getHeaderRowNow();
        if (headerRowNow) headerRowNow.querySelectorAll('.sort-indicator, .sort-indicator-left').forEach(el => el.remove());
        const labels = [
          ['?','Rarity'],
          ['?','Rarity'],
          ['?','限定'],
          ['?','限定'],
          ['?','カナ'],
          ['?','カナ'],
        ];
        const [arrow,label] = labels[phase];
        // 付与先のズレを回避：初期 clone 済みの nameTh を常にターゲットにする
        updateSortIndicator(nameTh, arrow, 'right', label); // テキストは updateSortIndicator 内で 0.8em 指定

        // 記憶（最後にソートされた列と方向）
        table.dataset.nameSortPhase = String(phase);
        table.dataset.nameSortLastApplied = `name:${phase}`;
        lastSortedColumn  = columnIds[id][nameTitle];
        lastSortAscending = (phase % 2 === 0); // 0,2,4=?（正順）, 1,3,5=?
      }

      // クリックで ①→②→③→④→⑤→⑥→… をループ（dataset リセット耐性）
      let nameSortPhase = Number(table.dataset.nameSortPhase || '0');
      nameTh.addEventListener('click', (ev)=>{
        ev.stopPropagation();
        ev.preventDefault();
        // 現在段階を適用
        applyCycleSort(nameSortPhase);
        // 次段階へ
        nameSortPhase = (nameSortPhase + 1) % 6;
        table.dataset.nameSortPhase = String(nameSortPhase);
        // 再適用は「直近適用済み」を優先（別処理で dataset が変化しても安定）
        lastSortMap[id] = ()=>applyCycleSort(Number((table.dataset.nameSortLastApplied||'name:0').split(':')[1]));
      });

      // 〓〓〓〓〓〓 テーブルソート状態の記憶 〓〓〓〓〓〓
      // rankCol（レアリティ列）を安全に取得し、見つからなければ本ブロックはスキップ
      const rankCol = (()=>{
        if (Number.isInteger(idxMap['レアリティ'])) return idxMap['レアリティ'];
        if (Number.isInteger(idxMap['ランク']))     return idxMap['ランク'];
        if (Number.isInteger(idxMap['Rarity']))    return idxMap['Rarity'];
        return -1;
      })();
      if (rankCol >= 0 && table.tBodies && table.tBodies[0]) {
        Array.from(table.tBodies[0].rows).forEach(r=>{
          const cell = r.cells[rankCol];
          cell.style.cursor='pointer';
          cell.addEventListener('click',()=>{
            const clicked=(cell.textContent.match(/UR|SSR|SR|R|N/)||['N'])[0];
            // rarity チェック群（elm）が存在する場合のみ同期（未定義でも落ちないように）
            if (typeof elm === 'object' && elm){
              Object.keys(elm).forEach(rk=>{
                if (elm[rk]) elm[rk].checked = (rk === clicked);
              });
            }
            applyFilter();applyColor();
            // 最後に記憶したソート状態（6段階サイクル等）があれば再適用
            if (typeof lastSortMap[id] === 'function') lastSortMap[id]();
            scrollToAnchorCell();
          });
        });
      }

      // 〓〓〓〓〓〓 初期適用：サーバー順を維持して色付けのみ 〓〓〓〓〓〓
      // weapon/armor ブロックでのみ定義される applyColor の未定義参照を回避
      if ((id === 'weaponTable' || id === 'armorTable') && typeof applyColor === 'function') {
        applyColor();
      }

    } // ← wireNameColumnSort の閉じ
  } // ← processTable の閉じ
})(); // ← IIFE の閉じ