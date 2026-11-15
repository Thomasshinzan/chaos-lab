/**
 * CHAOS LAB - ユニットテストスクリプト (test_simulation.js)
 * Node.js 環境で計算ロジック、PRNG再現性、アフィン変換、プリセットを網羅的に検証
 */

import { SimulationEngine, createPRNG, PRESETS, generateRegularPolygon } from './simulation.js';

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    passedTests++;
    console.log(`✅ PASS: ${message}`);
  }
}

console.log('=== CHAOS LAB ユニットテスト開始 ===\n');

// 1. PRNG 決定論的再現性テスト
{
  const prng1 = createPRNG('test-seed-12345');
  const prng2 = createPRNG('test-seed-12345');
  const vals1 = Array.from({ length: 10 }, () => prng1());
  const vals2 = Array.from({ length: 10 }, () => prng2());
  
  assert(
    vals1.every((v, i) => v === vals2[i]),
    'PRNG: 同一シードから生成される乱数列が完全に一致すること'
  );

  const prng3 = createPRNG('different-seed');
  const vals3 = Array.from({ length: 10 }, () => prng3());
  assert(
    vals1.some((v, i) => v !== vals3[i]),
    'PRNG: 異なるシードでは異なる乱数列が生成されること'
  );
}

// 2. 正多角形ターゲット生成テスト
{
  const targetsTriangle = generateRegularPolygon(3, 1.0, 0, 0, 0);
  assert(targetsTriangle.length === 3, '正多角形生成: 頂点数が3であること');
  assert(targetsTriangle[0].name === 'A' && targetsTriangle[1].name === 'B', '正多角形生成: 頂点名がアルファベットで割り振られること');

  const targetsHexagon = generateRegularPolygon(6, 1.0, 0, 0, 0);
  assert(targetsHexagon.length === 6, '正多角形生成: 頂点数が6であること');
}

// 3. シェルピンスキーのギャスケット シミュレーションテスト
{
  const preset = PRESETS.find(p => p.id === 'sierpinski_triangle');
  const engine1 = new SimulationEngine(preset);
  const engine2 = new SimulationEngine(preset);

  const batch1 = engine1.stepBatch(500);
  const batch2 = engine2.stepBatch(500);

  assert(batch1.points.length === 500, 'シェルピンスキー: 500点が正常に生成されること');
  assert(
    batch1.points.every((pt, i) => Math.abs(pt.x - batch2.points[i].x) < 1e-9 && Math.abs(pt.y - batch2.points[i].y) < 1e-9),
    'シェルピンスキー: 同一設定・シードで完全に再現されること'
  );

  // 頂点範囲内[-1, 1]に収まっているか
  const allInRange = batch1.points.every(pt => Math.abs(pt.x) <= 1.5 && Math.abs(pt.y) <= 1.5);
  assert(allInRange, 'シェルピンスキー: 生成された点が頂点のバウンディング近傍に収まっていること');
}

// 4. 移動率 (ratio) の変更反映テスト
{
  const presetA = JSON.parse(JSON.stringify(PRESETS[0]));
  presetA.rules.forEach(r => r.ratio = 0.5);
  const presetB = JSON.parse(JSON.stringify(PRESETS[0]));
  presetB.rules.forEach(r => r.ratio = 0.3);

  const engineA = new SimulationEngine(presetA);
  const engineB = new SimulationEngine(presetB);

  const batchA = engineA.stepBatch(50);
  const batchB = engineB.stepBatch(50);

  assert(
    batchA.points.some((pt, i) => pt.x !== batchB.points[i].x || pt.y !== batchB.points[i].y),
    '移動率の変更: ratioを変更すると異なる座標軌跡が生成されること'
  );
}

// 5. ルール確率の変更反映テスト
{
  const presetWeightedA = JSON.parse(JSON.stringify(PRESETS[0]));
  presetWeightedA.selectionStrategy = 'weighted';
  presetWeightedA.rules[0].weight = 100;
  presetWeightedA.rules[1].weight = 0;
  presetWeightedA.rules[2].weight = 0;

  const engineW = new SimulationEngine(presetWeightedA);
  const batchW = engineW.stepBatch(50);

  // ルール0のみが100%選ばれるため、全ての選択ルールインデックスが0であるはず
  const allRule0 = batchW.points.every(pt => pt.ruleIndex === 0);
  assert(allRule0, '確率指定: 特定ルール重み100%/他0%のとき、指定ルールのみが連続選択されること');
}

// 6. 順番に実行 (sequence) テスト
{
  const presetSeq = JSON.parse(JSON.stringify(PRESETS[0]));
  presetSeq.selectionStrategy = 'sequence';
  const engineSeq = new SimulationEngine(presetSeq);
  const batchSeq = engineSeq.stepBatch(9);

  const expectedSeq = [0, 1, 2, 0, 1, 2, 0, 1, 2];
  const actualSeq = batchSeq.points.map(p => p.ruleIndex);
  assert(
    actualSeq.every((idx, i) => idx === expectedSeq[i]),
    '順番に実行 (sequence): ルールが 0 -> 1 -> 2 -> 0 と巡回して適用されること'
  );
}

// 7. Barnsley Fern (アフィン変換 IFS) テスト
{
  const fernPreset = PRESETS.find(p => p.id === 'barnsley_fern');
  const fernEngine = new SimulationEngine(fernPreset);
  const fernBatch = fernEngine.stepBatch(1000);

  assert(fernBatch.points.length === 1000, 'Barnsley Fern: 1000点が生成されること');
  // バーンスレイのシダの範囲: x in [-3, 3], y in [0, 10.5]
  const inFernBBox = fernBatch.points.every(pt => pt.x >= -3 && pt.x <= 3 && pt.y >= -0.5 && pt.y <= 11);
  assert(inFernBBox, 'Barnsley Fern: 生成点がシダの理論バウンディングボックス内に収まること');

  // 各ルールの選択頻度（小葉 af2 が 85% なので最頻出であること）
  const ruleCounts = [0, 0, 0, 0];
  fernBatch.points.forEach(pt => ruleCounts[pt.ruleIndex]++);
  assert(ruleCounts[1] > 700, `Barnsley Fern: 確率85%の小葉ルールが最多回数 (${ruleCounts[1]}/1000) 選択されること`);
}

// 8. 異常値・発散・NaN ガードテスト
{
  const dangerousConfig = {
    mode: 'affine',
    selectionStrategy: 'uniform',
    burnIn: 0,
    totalSteps: 100,
    seed: 'danger',
    initialPoint: { x: 0, y: 0 },
    affineRules: [
      { a: 10, b: 10, c: 10, d: 10, e: 100, f: 100, weight: 1 } // 発散する係数
    ]
  };

  const dangerEngine = new SimulationEngine(dangerousConfig);
  let hasCrash = false;
  try {
    const dangerBatch = dangerEngine.stepBatch(50);
    // 異常値ガードにより NaN や Infinity にならずにフォールバックされる
    const allFinite = dangerBatch.points.every(pt => isFinite(pt.x) && isFinite(pt.y) && !isNaN(pt.x) && !isNaN(pt.y));
    assert(allFinite, '異常値ガード: 係数が発散しても NaN / Infinity が発生せず安全に制御されること');
  } catch (err) {
    hasCrash = true;
  }
  assert(!hasCrash, '異常値ガード: 計算エラーで例外クラッシュしないこと');
}

console.log(`\n=== テスト結果: ${passedTests} / ${totalTests} 合格 ===`);
if (passedTests === totalTests) {
  console.log('🎉 全テストに合格しました！');
}
