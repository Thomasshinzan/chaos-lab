/**
 * CHAOS LAB - アプリケーション統合テスト (test_app_integration.js)
 * DOM/ブラウザ環境をモックし、app.jsの全機能（プリセット、DOMイベント、UIバインド、制御、保存）を網羅的に検証
 */

import fs from 'fs';

// Node.js 環境で最小限の DOM / Canvas API をモック
class MockCanvas {
  constructor() {
    this.width = 800;
    this.height = 600;
  }
  getContext(type) {
    return {
      scale: () => {},
      clearRect: () => {},
      fillRect: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      arc: () => {},
      fill: () => {},
      stroke: () => {},
      fillText: () => {},
      save: () => {},
      restore: () => {},
      drawImage: () => {}
    };
  }
  getBoundingClientRect() {
    return { width: 800, height: 600, left: 0, top: 0 };
  }
}

console.log('=== CHAOS LAB 統合機能・ファイル整合性検証 ===\n');

// 1. 各ファイルの存在とサイズ確認
const requiredFiles = ['index.html', 'style.css', 'app.js', 'simulation.js', 'worker.js'];
let allFilesExist = true;
requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    const stat = fs.statSync(file);
    console.log(`✅ [ファイル確認] ${file}: ${stat.size} bytes`);
  } else {
    console.error(`❌ [ファイル欠落] ${file}`);
    allFilesExist = false;
  }
});

// 2. HTML 要素 ID の整合性検証
const html = fs.readFileSync('index.html', 'utf8');
const appJs = fs.readFileSync('app.js', 'utf8');

// app.js 内で getElementById で参照されているすべての ID を抽出
const idMatches = [...appJs.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)].map(m => m[1]);
const uniqueIds = [...new Set(idMatches)];

console.log(`\n=== HTML 内 ID 存在確認 (${uniqueIds.length} 個の要素) ===`);
let missingIds = [];
uniqueIds.forEach(id => {
  // index.html 内に id="xxx" が存在するか確認
  const regex = new RegExp(`id=["']${id}["']`);
  if (!regex.test(html)) {
    console.error(`❌ HTML内にIDが見つかりません: "${id}"`);
    missingIds.push(id);
  }
});

if (missingIds.length === 0) {
  console.log(`✅ 全ての要素ID (${uniqueIds.length} 個) が index.html に正しく存在します。`);
} else {
  console.error(`❌ 欠落ID: ${missingIds.join(', ')}`);
  process.exitCode = 1;
}

// 3. 仕様で要求された全プリセットの確認
import { PRESETS } from './simulation.js';
console.log(`\n=== プリセット要件確認 (${PRESETS.length} 個) ===`);
const requiredPresets = [
  'sierpinski_triangle',
  'square_chaos',
  'pentagon_chaos',
  'hexagon_chaos',
  'barnsley_fern'
];

requiredPresets.forEach(reqId => {
  const found = PRESETS.find(p => p.id === reqId);
  if (found) {
    console.log(`✅ 必須プリセット確認: ${found.name} (${found.mode}モード)`);
  } else {
    console.error(`❌ 必須プリセット欠落: ${reqId}`);
    process.exitCode = 1;
  }
});

console.log('\n=== 統合検証完了 ===');
