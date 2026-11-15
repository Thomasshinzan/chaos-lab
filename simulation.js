/**
 * CHAOS LAB - 数学・シミュレーションコアモジュール (simulation.js)
 * カオスゲームおよび反復関数系 (IFS: Iterated Function System) の計算ロジック
 */

// --- 決定論的疑似乱数生成器 (PRNG: Mulberry32 & SFC32) ---
export function xfnv1a(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  }
  return function() {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

export function createPRNG(seedInput) {
  let seedStr = String(seedInput ?? 'chaos-lab-default-seed');
  const seedGen = xfnv1a(seedStr);
  let a = seedGen();
  let b = seedGen();
  let c = seedGen();
  let d = seedGen();

  // SFC32 algorithm
  return function() {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b | 0) + d | 0;
    d = d + 1 | 0;
    a = b ^ (b >>> 9);
    b = c + (c << 3) | 0;
    c = (c << 21 | c >>> 11);
    c = c + t | 0;
    return (t >>> 0) / 4294967296;
  };
}

// --- 幾何学ヘルパー ---
export function generateRegularPolygon(n, radius, cx = 0, cy = 0, rotationDeg = 0) {
  const targets = [];
  const rotRad = (rotationDeg * Math.PI) / 180;
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  for (let i = 0; i < n; i++) {
    // 頂点を上向きから時計回りに配置
    const angle = rotRad + (2 * Math.PI * i) / n - Math.PI / 2;
    const x = cx + radius * Math.cos(angle);
    const y = cy - radius * Math.sin(angle); // 数学座標系 (上が+y)

    const label = i < alphabet.length 
      ? alphabet[i] 
      : `${alphabet[Math.floor(i / alphabet.length) - 1]}${alphabet[i % alphabet.length]}`;

    // 色パレットから自動付与
    const hue = Math.round((360 * i) / n);
    const color = `hsl(${hue}, 85%, 60%)`;

    targets.push({
      id: `target_${i}_${Date.now()}`,
      name: label,
      x: Number(x.toFixed(4)),
      y: Number(y.toFixed(4)),
      color: color
    });
  }
  return targets;
}

// --- プリセット定義 ---
export const PRESETS = [
  {
    id: 'sierpinski_triangle',
    name: '1. シェルピンスキーのギャスケット',
    description: '正三角形の各頂点に50%ずつ接近する古典的なカオスゲーム',
    mode: 'basic',
    selectionStrategy: 'uniform',
    burnIn: 50,
    totalSteps: 100000,
    speed: 15000,
    pointSize: 1.5,
    pointOpacity: 0.75,
    bgColor: '#0a0e17',
    colorMode: 'rule',
    singleColor: '#00f2fe',
    seed: 'sierpinski-3',
    initialPoint: { x: 0, y: 0, random: true },
    targets: generateRegularPolygon(3, 1.0, 0, 0, 0),
    rules: [
      { id: 'r0', name: '頂点 A へ接近', type: 'target', targetIndex: 0, ratio: 0.5, weight: 1, color: '#ff3366' },
      { id: 'r1', name: '頂点 B へ接近', type: 'target', targetIndex: 1, ratio: 0.5, weight: 1, color: '#00f2fe' },
      { id: 'r2', name: '頂点 C へ接近', type: 'target', targetIndex: 2, ratio: 0.5, weight: 1, color: '#39ff14' }
    ],
    affineRules: []
  },
  {
    id: 'square_chaos',
    name: '2. 四角形のカオスゲーム',
    description: '正方形の頂点に50%接近（均等選択）',
    mode: 'basic',
    selectionStrategy: 'uniform',
    burnIn: 50,
    totalSteps: 100000,
    speed: 15000,
    pointSize: 1.5,
    pointOpacity: 0.7,
    bgColor: '#0a0e17',
    colorMode: 'rule',
    singleColor: '#4facfe',
    seed: 'square-4',
    initialPoint: { x: 0, y: 0, random: true },
    targets: generateRegularPolygon(4, 1.0, 0, 0, 45),
    rules: [
      { id: 'r0', name: '頂点 A へ接近', type: 'target', targetIndex: 0, ratio: 0.5, weight: 1, color: '#ff007f' },
      { id: 'r1', name: '頂点 B へ接近', type: 'target', targetIndex: 1, ratio: 0.5, weight: 1, color: '#00d2ff' },
      { id: 'r2', name: '頂点 C へ接近', type: 'target', targetIndex: 2, ratio: 0.5, weight: 1, color: '#00f5a0' },
      { id: 'r3', name: '頂点 D へ接近', type: 'target', targetIndex: 3, ratio: 0.5, weight: 1, color: '#fddb3a' }
    ],
    affineRules: []
  },
  {
    id: 'pentagon_chaos',
    name: '3. 五角形のカオスゲーム',
    description: '正五角形の頂点に黄金比の割合 (約38.2%) で接近して現れるフラクタル',
    mode: 'basic',
    selectionStrategy: 'uniform',
    burnIn: 50,
    totalSteps: 120000,
    speed: 15000,
    pointSize: 1.5,
    pointOpacity: 0.75,
    bgColor: '#0a0e17',
    colorMode: 'rule',
    singleColor: '#9b51e0',
    seed: 'pentagon-5',
    initialPoint: { x: 0, y: 0, random: true },
    targets: generateRegularPolygon(5, 1.0, 0, 0, 0),
    rules: [
      { id: 'r0', name: '頂点 A (38.2%)', type: 'target', targetIndex: 0, ratio: 0.382, weight: 1, color: '#ff4b72' },
      { id: 'r1', name: '頂点 B (38.2%)', type: 'target', targetIndex: 1, ratio: 0.382, weight: 1, color: '#a855f7' },
      { id: 'r2', name: '頂点 C (38.2%)', type: 'target', targetIndex: 2, ratio: 0.382, weight: 1, color: '#00f2fe' },
      { id: 'r3', name: '頂点 D (38.2%)', type: 'target', targetIndex: 3, ratio: 0.382, weight: 1, color: '#10b981' },
      { id: 'r4', name: '頂点 E (38.2%)', type: 'target', targetIndex: 4, ratio: 0.382, weight: 1, color: '#f59e0b' }
    ],
    affineRules: []
  },
  {
    id: 'hexagon_chaos',
    name: '4. 六角形のカオスゲーム',
    description: '正六角形の頂点に移動比率 2/3 (66.7%) で接近',
    mode: 'basic',
    selectionStrategy: 'uniform',
    burnIn: 50,
    totalSteps: 150000,
    speed: 18000,
    pointSize: 1.5,
    pointOpacity: 0.7,
    bgColor: '#0a0e17',
    colorMode: 'rule',
    singleColor: '#00f2fe',
    seed: 'hexagon-6',
    initialPoint: { x: 0, y: 0, random: true },
    targets: generateRegularPolygon(6, 1.0, 0, 0, 0),
    rules: [
      { id: 'r0', name: '頂点 A (66.7%)', type: 'target', targetIndex: 0, ratio: 0.667, weight: 1, color: '#ef4444' },
      { id: 'r1', name: '頂点 B (66.7%)', type: 'target', targetIndex: 1, ratio: 0.667, weight: 1, color: '#f97316' },
      { id: 'r2', name: '頂点 C (66.7%)', type: 'target', targetIndex: 2, ratio: 0.667, weight: 1, color: '#eab308' },
      { id: 'r3', name: '頂点 D (66.7%)', type: 'target', targetIndex: 3, ratio: 0.667, weight: 1, color: '#10b981' },
      { id: 'r4', name: '頂点 E (66.7%)', type: 'target', targetIndex: 4, ratio: 0.667, weight: 1, color: '#06b6d4' },
      { id: 'r5', name: '頂点 F (66.7%)', type: 'target', targetIndex: 5, ratio: 0.667, weight: 1, color: '#8b5cf6' }
    ],
    affineRules: []
  },
  {
    id: 'barnsley_fern',
    name: '5. Barnsley Fern (バーンスレイのシダ)',
    description: '4つのアフィン変換によってシダ植物の葉を生成する代表的なIFSフラクタル',
    mode: 'affine',
    selectionStrategy: 'weighted',
    burnIn: 50,
    totalSteps: 150000,
    speed: 15000,
    pointSize: 1.5,
    pointOpacity: 0.8,
    bgColor: '#060d08',
    colorMode: 'rule',
    singleColor: '#10b981',
    seed: 'barnsley-fern',
    initialPoint: { x: 0, y: 0, random: false },
    targets: [],
    rules: [],
    affineRules: [
      { id: 'af1', name: '茎 (Stem)', a: 0, b: 0, c: 0, d: 0.16, e: 0, f: 0, weight: 1, color: '#854d0e' },
      { id: 'af2', name: '小葉 (Smaller leaflets)', a: 0.85, b: 0.04, c: -0.04, d: 0.85, e: 0, f: 1.6, weight: 85, color: '#22c55e' },
      { id: 'af3', name: '左大側葉 (Left leaflet)', a: 0.20, b: -0.26, c: 0.23, d: 0.22, e: 0, f: 1.6, weight: 7, color: '#84cc16' },
      { id: 'af4', name: '右大側葉 (Right leaflet)', a: -0.15, b: 0.28, c: 0.26, d: 0.24, e: 0, f: 0.44, weight: 7, color: '#10b981' }
    ]
  },
  {
    id: 'dragon_curve',
    name: '6. Heighway Dragon (ドラゴン曲線)',
    description: '紙の折り畳みからも生じる2つのアフィン縮小回転変換によるフラクタル',
    mode: 'affine',
    selectionStrategy: 'weighted',
    burnIn: 50,
    totalSteps: 100000,
    speed: 15000,
    pointSize: 1.5,
    pointOpacity: 0.75,
    bgColor: '#0a0e17',
    colorMode: 'rule',
    singleColor: '#f43f5e',
    seed: 'dragon-curve',
    initialPoint: { x: 0, y: 0, random: false },
    targets: [],
    rules: [],
    affineRules: [
      { id: 'df1', name: '左翼 (Branch A)', a: 0.5, b: -0.5, c: 0.5, d: 0.5, e: 0, f: 0, weight: 50, color: '#06b6d4' },
      { id: 'df2', name: '右翼 (Branch B)', a: -0.5, b: -0.5, c: 0.5, d: -0.5, e: 1, f: 0, weight: 50, color: '#f43f5e' }
    ]
  },
  {
    id: 'sierpinski_carpet',
    name: '7. シェルピンスキーのカーペット',
    description: '正方形の周囲8点に 2/3 (66.7%) で接近する多ターゲットカオスゲーム',
    mode: 'basic',
    selectionStrategy: 'uniform',
    burnIn: 50,
    totalSteps: 120000,
    speed: 15000,
    pointSize: 1.5,
    pointOpacity: 0.7,
    bgColor: '#0a0e17',
    colorMode: 'rule',
    singleColor: '#38bdf8',
    seed: 'carpet-8',
    initialPoint: { x: 0, y: 0, random: true },
    targets: [
      { id: 't0', name: 'A', x: -1, y: 1, color: '#38bdf8' },
      { id: 't1', name: 'B', x: 0, y: 1, color: '#38bdf8' },
      { id: 't2', name: 'C', x: 1, y: 1, color: '#38bdf8' },
      { id: 't3', name: 'D', x: -1, y: 0, color: '#38bdf8' },
      { id: 't4', name: 'E', x: 1, y: 0, color: '#38bdf8' },
      { id: 't5', name: 'F', x: -1, y: -1, color: '#38bdf8' },
      { id: 't6', name: 'G', x: 0, y: -1, color: '#38bdf8' },
      { id: 't7', name: 'H', x: 1, y: -1, color: '#38bdf8' }
    ],
    rules: [
      { id: 'r0', name: 'A へ 2/3接近', type: 'target', targetIndex: 0, ratio: 0.6667, weight: 1, color: '#f43f5e' },
      { id: 'r1', name: 'B へ 2/3接近', type: 'target', targetIndex: 1, ratio: 0.6667, weight: 1, color: '#fb923c' },
      { id: 'r2', name: 'C へ 2/3接近', type: 'target', targetIndex: 2, ratio: 0.6667, weight: 1, color: '#facc15' },
      { id: 'r3', name: 'D へ 2/3接近', type: 'target', targetIndex: 3, ratio: 0.6667, weight: 1, color: '#4ade80' },
      { id: 'r4', name: 'E へ 2/3接近', type: 'target', targetIndex: 4, ratio: 0.6667, weight: 1, color: '#2dd4bf' },
      { id: 'r5', name: 'F へ 2/3接近', type: 'target', targetIndex: 5, ratio: 0.6667, weight: 1, color: '#38bdf8' },
      { id: 'r6', name: 'G へ 2/3接近', type: 'target', targetIndex: 6, ratio: 0.6667, weight: 1, color: '#818cf8' },
      { id: 'r7', name: 'H へ 2/3接近', type: 'target', targetIndex: 7, ratio: 0.6667, weight: 1, color: '#c084fc' }
    ],
    affineRules: []
  }
];

// --- シミュレーション計算エンジンコア ---
export class SimulationEngine {
  constructor(config = {}) {
    this.setConfig(config);
  }

  setConfig(config) {
    this.config = {
      mode: config.mode || 'basic', // 'basic' | 'affine'
      selectionStrategy: config.selectionStrategy || 'uniform', // 'uniform' | 'weighted' | 'sequence'
      burnIn: config.burnIn ?? 50,
      totalSteps: config.totalSteps ?? 100000,
      speed: config.speed ?? 10000,
      seed: config.seed ?? 'chaos-lab',
      initialPoint: config.initialPoint || { x: 0, y: 0, random: true },
      targets: (config.targets || []).map(t => ({ ...t })),
      rules: (config.rules || []).map(r => ({ ...r })),
      affineRules: (config.affineRules || []).map(a => ({ ...a }))
    };

    this.reset();
  }

  reset() {
    this.prng = createPRNG(this.config.seed);
    this.currentStep = 0;
    this.sequenceIndex = 0;

    // 初期点決定
    if (this.config.initialPoint.random) {
      if (this.config.mode === 'basic' && this.config.targets.length > 0) {
        // ターゲットのいずれかの近傍に配置
        const idx = Math.floor(this.prng() * this.config.targets.length);
        const t = this.config.targets[idx];
        this.currentPoint = {
          x: t.x + (this.prng() - 0.5) * 0.1,
          y: t.y + (this.prng() - 0.5) * 0.1
        };
      } else {
        this.currentPoint = {
          x: (this.prng() - 0.5) * 2,
          y: (this.prng() - 0.5) * 2
        };
      }
    } else {
      this.currentPoint = {
        x: Number(this.config.initialPoint.x) || 0,
        y: Number(this.config.initialPoint.y) || 0
      };
    }

    this.lastSafePoint = { ...this.currentPoint };
    this.prepareProbabilities();

    // Burn-in (安定化のための初期反復)
    for (let i = 0; i < this.config.burnIn; i++) {
      this.step(false);
    }

    // 順番実行モードの場合は記録開始時にインデックスを0に戻す
    this.sequenceIndex = 0;
  }

  prepareProbabilities() {
    const isAffine = this.config.mode === 'affine';
    const activeRules = isAffine ? this.config.affineRules : this.config.rules;

    this.cumulativeProb = [];
    if (!activeRules || activeRules.length === 0) {
      this.normalizedWeights = [];
      return;
    }

    if (this.config.selectionStrategy === 'uniform') {
      const p = 1 / activeRules.length;
      let sum = 0;
      for (let i = 0; i < activeRules.length; i++) {
        sum += p;
        this.cumulativeProb.push(sum);
      }
    } else if (this.config.selectionStrategy === 'weighted') {
      let totalWeight = 0;
      for (let r of activeRules) {
        const w = Math.max(0, Number(r.weight) || 0);
        totalWeight += w;
      }

      if (totalWeight <= 0) {
        // すべて0の場合は均等にフォールバック
        const p = 1 / activeRules.length;
        let sum = 0;
        for (let i = 0; i < activeRules.length; i++) {
          sum += p;
          this.cumulativeProb.push(sum);
        }
      } else {
        let sum = 0;
        for (let r of activeRules) {
          const w = Math.max(0, Number(r.weight) || 0);
          sum += w / totalWeight;
          this.cumulativeProb.push(sum);
        }
        // 丸め誤差対策で最後は1.0にする
        this.cumulativeProb[this.cumulativeProb.length - 1] = 1.0;
      }
    }
  }

  selectRuleIndex() {
    const isAffine = this.config.mode === 'affine';
    const rules = isAffine ? this.config.affineRules : this.config.rules;
    const n = rules.length;
    if (n === 0) return -1;
    if (n === 1) return 0;

    if (this.config.selectionStrategy === 'sequence') {
      const idx = this.sequenceIndex % n;
      this.sequenceIndex = (this.sequenceIndex + 1) % n;
      return idx;
    }

    const r = this.prng();
    for (let i = 0; i < n; i++) {
      if (r <= this.cumulativeProb[i]) {
        return i;
      }
    }
    return n - 1;
  }

  step(countStep = true) {
    const isAffine = this.config.mode === 'affine';
    const rules = isAffine ? this.config.affineRules : this.config.rules;

    if (!rules || rules.length === 0) {
      return null;
    }

    const ruleIndex = this.selectRuleIndex();
    if (ruleIndex < 0) return null;

    const rule = rules[ruleIndex];
    let nextX = this.currentPoint.x;
    let nextY = this.currentPoint.y;

    if (isAffine) {
      // アフィン変換: x' = ax + by + e, y' = cx + dy + f
      const a = Number(rule.a) || 0;
      const b = Number(rule.b) || 0;
      const c = Number(rule.c) || 0;
      const d = Number(rule.d) || 0;
      const e = Number(rule.e) || 0;
      const f = Number(rule.f) || 0;

      nextX = a * this.currentPoint.x + b * this.currentPoint.y + e;
      nextY = c * this.currentPoint.x + d * this.currentPoint.y + f;
    } else {
      // 基本モード
      const ratio = Number(rule.ratio) ?? 0.5;

      switch (rule.type) {
        case 'target': {
          // ① ターゲットへ接近: x' = x + r(tx - x), y' = y + r(ty - y)
          let target = null;
          if (rule.targetIndex !== undefined && this.config.targets[rule.targetIndex]) {
            target = this.config.targets[rule.targetIndex];
          } else if (rule.targetId) {
            target = this.config.targets.find(t => t.id === rule.targetId);
          }
          if (!target && this.config.targets.length > 0) {
            target = this.config.targets[0];
          }

          if (target) {
            nextX = this.currentPoint.x + ratio * (target.x - this.currentPoint.x);
            nextY = this.currentPoint.y + ratio * (target.y - this.currentPoint.y);
          }
          break;
        }

        case 'center': {
          // ② 中心へ接近
          const cx = Number(rule.centerX) || 0;
          const cy = Number(rule.centerY) || 0;
          nextX = this.currentPoint.x + ratio * (cx - this.currentPoint.x);
          nextY = this.currentPoint.y + ratio * (cy - this.currentPoint.y);
          break;
        }

        case 'translate': {
          // ③ 平行移動
          const dx = Number(rule.dx) || 0;
          const dy = Number(rule.dy) || 0;
          nextX = this.currentPoint.x + dx;
          nextY = this.currentPoint.y + dy;
          break;
        }

        case 'rotate': {
          // ④ 回転移動
          const cx = Number(rule.centerX) || 0;
          const cy = Number(rule.centerY) || 0;
          const rad = ((Number(rule.angle) || 0) * Math.PI) / 180;
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          const rx = this.currentPoint.x - cx;
          const ry = this.currentPoint.y - cy;
          nextX = cx + (rx * cos - ry * sin);
          nextY = cy + (rx * sin + ry * cos);
          break;
        }

        case 'scale': {
          // ⑤ 拡大・縮小
          const cx = Number(rule.centerX) || 0;
          const cy = Number(rule.centerY) || 0;
          const s = Number(rule.scale) ?? 0.5;
          nextX = cx + s * (this.currentPoint.x - cx);
          nextY = cy + s * (this.currentPoint.y - cy);
          break;
        }

        case 'random': {
          // ⑥ ランダム移動
          const range = Number(rule.randomRange) || 0.1;
          nextX = this.currentPoint.x + (this.prng() - 0.5) * 2 * range;
          nextY = this.currentPoint.y + (this.prng() - 0.5) * 2 * range;
          break;
        }

        default:
          break;
      }
    }

    // 異常値チェック (NaN, Infinity, 極端な巨大値ガード)
    if (
      isNaN(nextX) || !isFinite(nextX) ||
      isNaN(nextY) || !isFinite(nextY) ||
      Math.abs(nextX) > 1e6 || Math.abs(nextY) > 1e6
    ) {
      // 安全のため直前の安全な点、あるいは中心にフォールバック
      nextX = this.lastSafePoint.x || 0;
      nextY = this.lastSafePoint.y || 0;
    } else {
      this.lastSafePoint = { x: nextX, y: nextY };
    }

    this.currentPoint = { x: nextX, y: nextY };

    if (countStep) {
      this.currentStep++;
    }

    return {
      x: nextX,
      y: nextY,
      ruleIndex: ruleIndex,
      ruleName: rule.name || `Rule ${ruleIndex + 1}`,
      color: rule.color || '#00f2fe',
      step: this.currentStep
    };
  }

  // 複数ステップを一括計算 (バッチ処理)
  stepBatch(count) {
    const points = [];
    const limit = Math.min(count, this.config.totalSteps - this.currentStep);

    for (let i = 0; i < limit; i++) {
      const pt = this.step(true);
      if (pt) {
        points.push(pt);
      } else {
        break;
      }
    }

    return {
      points,
      currentStep: this.currentStep,
      isFinished: this.currentStep >= this.config.totalSteps
    };
  }
}
