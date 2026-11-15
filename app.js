/**
 * CHAOS LAB - メインアプリケーション (app.js)
 * UI制御、Canvas 2Dレンダリング、タッチ・マウス操作、Web Worker連携
 */

import { PRESETS, generateRegularPolygon, SimulationEngine } from './simulation.js';

class ChaosLabApp {
  constructor() {
    this.currentPresetId = 'sierpinski_triangle';
    this.config = JSON.parse(JSON.stringify(PRESETS[0]));
    this.simState = 'idle'; // 'idle' | 'running' | 'paused' | 'stopped' | 'finished'
    
    // パフォーマンス計測
    this.lastBatchTime = performance.now();
    this.batchPointCount = 0;
    this.currentSpeedPtsPerSec = 0;
    this.currentPoint = { x: 0, y: 0 };
    this.currentStep = 0;
    this.lastRule = null;

    // ビューポート (ワールド座標系 → スクリーン座標系)
    this.viewport = {
      scale: 250, // 1ワールド単位 = 250px
      originX: 0,
      originY: 0,
      isDragging: false,
      dragStartX: 0,
      dragStartY: 0,
      dragTarget: null,
      pinchDistance: 0
    };

    // DOM要素キャッシュ
    this.cacheElements();

    // Canvas初期化
    this.initCanvas();

    // Worker 初期化 (フォールバック付き)
    this.initWorker();

    // UIイベントリスナー登録
    this.bindEvents();

    // プリセットUI初期化
    this.populatePresets();
    this.loadPreset(this.currentPresetId);

    // 初期ビューポート調整
    this.fitView();

    // UI常時更新ループ (rAF)
    this.startUIRenderLoop();
  }

  cacheElements() {
    this.dom = {
      // ヘッダー
      presetSelect: document.getElementById('preset-select'),
      btnModeBasic: document.getElementById('btn-mode-basic'),
      btnModeAffine: document.getElementById('btn-mode-affine'),
      btnExportJson: document.getElementById('btn-export-json'),
      btnImportJson: document.getElementById('btn-import-json'),
      fileInputJson: document.getElementById('file-input-json'),
      btnExportPng: document.getElementById('btn-export-png'),
      btnToggleSidebar: document.getElementById('btn-toggle-sidebar'),
      btnSidebarModeBasic: document.getElementById('btn-sidebar-mode-basic'),
      btnSidebarModeAffine: document.getElementById('btn-sidebar-mode-affine'),
      sidebar: document.getElementById('sidebar'),
      sidebarBackdrop: document.getElementById('sidebar-backdrop'),
      toastContainer: document.getElementById('toast-container'),

      // タブ
      sidebarTabs: document.querySelectorAll('.sidebar-tab'),
      tabPanes: document.querySelectorAll('.tab-pane'),
      tabBtnTargets: document.getElementById('tab-btn-targets'),

      // ルール設定
      strategyRadios: document.querySelectorAll('input[name="selection-strategy"]'),
      strategyBadge: document.getElementById('strategy-badge'),
      basicRulesSection: document.getElementById('basic-rules-section'),
      basicRulesList: document.getElementById('basic-rules-list'),
      btnAddBasicRule: document.getElementById('btn-add-basic-rule'),
      affineRulesSection: document.getElementById('affine-rules-section'),
      affineRulesList: document.getElementById('affine-rules-list'),
      btnAddAffineRule: document.getElementById('btn-add-affine-rule'),

      // ターゲット設定
      polyN: document.getElementById('poly-n'),
      polyNVal: document.getElementById('poly-n-val'),
      polyR: document.getElementById('poly-r'),
      polyRVal: document.getElementById('poly-r-val'),
      polyRot: document.getElementById('poly-rot'),
      polyRotVal: document.getElementById('poly-rot-val'),
      btnGeneratePoly: document.getElementById('btn-generate-poly'),
      chkCanvasClickAdd: document.getElementById('chk-canvas-click-add'),
      btnAddTarget: document.getElementById('btn-add-target'),
      targetsList: document.getElementById('targets-list'),

      // パラメータ
      paramTotalSteps: document.getElementById('param-total-steps'),
      totalStepsVal: document.getElementById('total-steps-val'),
      stepChips: document.querySelectorAll('.btn-chip'),
      paramSpeed: document.getElementById('param-speed'),
      speedVal: document.getElementById('speed-val'),
      paramBurnin: document.getElementById('param-burnin'),
      burninVal: document.getElementById('burnin-val'),
      chkRandomInitial: document.getElementById('chk-random-initial'),
      initialCoordInputs: document.getElementById('initial-coord-inputs'),
      paramInitX: document.getElementById('param-init-x'),
      paramInitY: document.getElementById('param-init-y'),
      paramSeed: document.getElementById('param-seed'),
      btnRandomSeed: document.getElementById('btn-random-seed'),

      // 描画・表示
      pointSize: document.getElementById('point-size'),
      pointSizeVal: document.getElementById('point-size-val'),
      pointOpacity: document.getElementById('point-opacity'),
      pointOpacityVal: document.getElementById('point-opacity-val'),
      colorModeRadios: document.querySelectorAll('input[name="color-mode"]'),
      singleColorPickerGroup: document.getElementById('single-color-picker-group'),
      singleColor: document.getElementById('single-color'),
      bgColor: document.getElementById('bg-color'),
      bgColorHex: document.getElementById('bg-color-hex'),
      colorChips: document.querySelectorAll('.color-chip'),
      chkShowTargets: document.getElementById('chk-show-targets'),
      chkShowCurrentPt: document.getElementById('chk-show-current-pt'),
      chkShowGrid: document.getElementById('chk-show-grid'),

      // Canvas
      canvasContainer: document.getElementById('canvas-container'),
      pointsCanvas: document.getElementById('points-canvas'),
      uiCanvas: document.getElementById('ui-canvas'),

      // HUD
      hudCurrentStep: document.getElementById('hud-current-step'),
      hudTotalStep: document.getElementById('hud-total-step'),
      hudProgressFill: document.getElementById('hud-progress-fill'),
      hudPercent: document.getElementById('hud-percent'),
      hudSpeed: document.getElementById('hud-speed'),
      hudRuleDot: document.getElementById('hud-rule-dot'),
      hudRuleName: document.getElementById('hud-rule-name'),
      hudCoords: document.getElementById('hud-coords'),

      // コントロール
      btnStart: document.getElementById('btn-start'),
      btnStartLabel: document.getElementById('btn-start-label'),
      btnPause: document.getElementById('btn-pause'),
      btnStep: document.getElementById('btn-step'),
      btnStop: document.getElementById('btn-stop'),
      btnReset: document.getElementById('btn-reset'),
      btnZoomIn: document.getElementById('btn-zoom-in'),
      btnZoomOut: document.getElementById('btn-zoom-out'),
      btnFitView: document.getElementById('btn-fit-view'),
      btnClearCanvas: document.getElementById('btn-clear-canvas')
    };

    this.pointsCtx = this.dom.pointsCanvas.getContext('2d');
    this.uiCtx = this.dom.uiCanvas.getContext('2d');
  }

  initCanvas() {
    const resize = () => {
      const rect = this.dom.canvasContainer.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      // 画面解像度に合わせて Canvas サイズ設定
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);

      if (this.dom.pointsCanvas.width !== w * dpr || this.dom.pointsCanvas.height !== h * dpr) {
        // 解像度変更時に点Canvasの内容を一時保存して維持
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.dom.pointsCanvas.width;
        tempCanvas.height = this.dom.pointsCanvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        if (tempCanvas.width > 0 && tempCanvas.height > 0) {
          tempCtx.drawImage(this.dom.pointsCanvas, 0, 0);
        }

        this.dom.pointsCanvas.width = w * dpr;
        this.dom.pointsCanvas.height = h * dpr;
        this.dom.uiCanvas.width = w * dpr;
        this.dom.uiCanvas.height = h * dpr;

        this.pointsCtx.scale(dpr, dpr);
        this.uiCtx.scale(dpr, dpr);

        this.pointsCanvasWidth = w;
        this.pointsCanvasHeight = h;

        // 背景クリア
        this.clearPointsCanvas();

        // 一時保存内容を描画
        if (tempCanvas.width > 0 && tempCanvas.height > 0) {
          this.pointsCtx.drawImage(tempCanvas, 0, 0, w, h);
        }

        // 初期原点設定（キャンバス中央）
        if (this.viewport.originX === 0 && this.viewport.originY === 0) {
          this.viewport.originX = w / 2;
          this.viewport.originY = h / 2;
        }
      }
    };

    window.addEventListener('resize', resize);
    resize();
  }

  initWorker() {
    this.useWorker = false;
    try {
      this.worker = new Worker('worker.js', { type: 'module' });
      this.useWorker = true;

      this.worker.onmessage = (e) => {
        this.handleWorkerMessage(e.data);
      };

      this.worker.onerror = (err) => {
        console.warn('[Web Worker Warning] Falling back to Main Thread engine:', err);
        this.useWorker = false;
        this.initFallbackEngine();
      };
    } catch (e) {
      console.warn('[Web Worker Unavailable] Running on Main Thread:', e);
      this.useWorker = false;
      this.initFallbackEngine();
    }
  }

  initFallbackEngine() {
    this.fallbackEngine = new SimulationEngine(this.config);
    this.fallbackTimer = null;
  }

  handleWorkerMessage(data) {
    switch (data.type) {
      case 'batch':
        this.renderPointsBatch(data.points);
        this.currentStep = data.currentStep;
        if (data.points.length > 0) {
          const lastPt = data.points[data.points.length - 1];
          this.currentPoint = { x: lastPt.x, y: lastPt.y };
          this.lastRule = { name: lastPt.ruleName, color: lastPt.color };
        }
        this.updateSpeedMetrics(data.points.length);
        this.updateHUD();
        if (data.isFinished) {
          this.setSimState('finished');
        }
        break;

      case 'stepResult':
        if (data.point) {
          this.renderPointsBatch([data.point]);
          this.currentPoint = { x: data.point.x, y: data.point.y };
          this.lastRule = { name: data.point.ruleName, color: data.point.color };
        }
        this.currentStep = data.currentStep;
        this.updateHUD();
        if (data.isFinished) {
          this.setSimState('finished');
        }
        break;

      case 'statusChanged':
        this.setSimState(data.status);
        break;

      case 'resetDone':
        this.currentStep = 0;
        this.currentPoint = data.currentPoint || { x: 0, y: 0 };
        this.clearPointsCanvas();
        this.setSimState('idle');
        this.updateHUD();
        break;

      case 'finished':
        this.setSimState('finished');
        break;
    }
  }

  // --- 座標変換 (ワールド座標 ⇄ スクリーン座標) ---
  worldToScreen(wx, wy) {
    return {
      x: this.viewport.originX + wx * this.viewport.scale,
      y: this.viewport.originY - wy * this.viewport.scale // 数学座標系: 上が+Y
    };
  }

  screenToWorld(sx, sy) {
    return {
      x: (sx - this.viewport.originX) / this.viewport.scale,
      y: (this.viewport.originY - sy) / this.viewport.scale
    };
  }

  // --- 点の高速描画 ---
  renderPointsBatch(points) {
    const ctx = this.pointsCtx;
    const size = Number(this.config.pointSize) || 1.5;
    const opacity = Number(this.config.pointOpacity) || 0.75;
    const isSingleColor = this.config.colorMode === 'single';
    const singleColor = this.config.singleColor || '#00f2fe';

    ctx.save();
    ctx.globalAlpha = opacity;

    // 色ごとにグループ化して高速バッチ描画
    if (isSingleColor) {
      ctx.fillStyle = singleColor;
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const s = this.worldToScreen(p.x, p.y);
        ctx.fillRect(s.x - size / 2, s.y - size / 2, size, size);
      }
    } else {
      // ルール色ごとにプロット
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const s = this.worldToScreen(p.x, p.y);
        ctx.fillStyle = p.color || '#00f2fe';
        ctx.fillRect(s.x - size / 2, s.y - size / 2, size, size);
      }
    }

    ctx.restore();
  }

  clearPointsCanvas() {
    const w = this.pointsCanvasWidth || this.dom.pointsCanvas.width;
    const h = this.pointsCanvasHeight || this.dom.pointsCanvas.height;
    this.pointsCtx.fillStyle = this.config.bgColor || '#0a0e17';
    this.pointsCtx.fillRect(0, 0, w, h);
  }

  // --- UIオーバーレイ描画ループ ---
  startUIRenderLoop() {
    const loop = () => {
      this.renderUI();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  renderUI() {
    const ctx = this.uiCtx;
    const w = this.pointsCanvasWidth || this.dom.uiCanvas.width;
    const h = this.pointsCanvasHeight || this.dom.uiCanvas.height;
    ctx.clearRect(0, 0, w, h);

    // 1. グリッド & 座標軸
    if (this.config.showGrid !== false) {
      this.renderGrid(ctx, w, h);
    }

    // 2. ターゲットの描画 (基本モード時)
    if (this.config.mode === 'basic' && this.config.showTargets !== false) {
      this.renderTargets(ctx);
    }

    // 3. 現在点 P(n) のハイライトパルス
    if (this.config.showCurrentPt !== false && this.currentPoint) {
      this.renderCurrentPointMarker(ctx);
    }
  }

  renderGrid(ctx, w, h) {
    ctx.save();
    const origin = this.worldToScreen(0, 0);

    // 座標軸 (X軸・Y軸)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;

    // X軸
    ctx.beginPath();
    ctx.moveTo(0, origin.y);
    ctx.lineTo(w, origin.y);
    ctx.stroke();

    // Y軸
    ctx.beginPath();
    ctx.moveTo(origin.x, 0);
    ctx.lineTo(origin.x, h);
    ctx.stroke();

    // 原点マーク
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.arc(origin.x, origin.y, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  renderTargets(ctx) {
    const targets = this.config.targets || [];
    const isHoveredOrDragging = (t) => this.viewport.dragTarget === t;

    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      const s = this.worldToScreen(t.x, t.y);
      const isDragging = isHoveredOrDragging(t);
      const radius = isDragging ? 14 : 10;

      ctx.save();

      // 外周グロー
      ctx.shadowColor = t.color || '#00f2fe';
      ctx.shadowBlur = isDragging ? 16 : 8;

      // ターゲット外枠円
      ctx.fillStyle = 'rgba(10, 14, 23, 0.85)';
      ctx.strokeStyle = t.color || '#00f2fe';
      ctx.lineWidth = isDragging ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.arc(s.x, s.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // ターゲット文字ラベル
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t.name || String.fromCharCode(65 + i), s.x, s.y);

      ctx.restore();
    }
  }

  renderCurrentPointMarker(ctx) {
    const s = this.worldToScreen(this.currentPoint.x, this.currentPoint.y);
    const now = performance.now();
    const pulse = 1 + 0.3 * Math.sin(now / 150);

    ctx.save();
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 6 * pulse, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#ff0055';
    ctx.beginPath();
    ctx.arc(s.x, s.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // --- ビューポート自動フィット ---
  fitView() {
    const w = this.pointsCanvasWidth || this.dom.pointsCanvas.width;
    const h = this.pointsCanvasHeight || this.dom.pointsCanvas.height;

    let minX = -1, maxX = 1, minY = -1, maxY = 1;

    if (this.config.mode === 'basic' && this.config.targets && this.config.targets.length > 0) {
      minX = Math.min(...this.config.targets.map(t => t.x));
      maxX = Math.max(...this.config.targets.map(t => t.x));
      minY = Math.min(...this.config.targets.map(t => t.y));
      maxY = Math.max(...this.config.targets.map(t => t.y));
    } else if (this.config.mode === 'affine') {
      if (this.config.id === 'barnsley_fern') {
        minX = -2.5; maxX = 2.5; minY = 0; maxY = 10;
      } else if (this.config.id === 'dragon_curve') {
        minX = -0.5; maxX = 1.5; minY = -0.5; maxY = 1.2;
      } else {
        minX = -2; maxX = 2; minY = -2; maxY = 2;
      }
    }

    const spanX = Math.max(0.1, (maxX - minX) * 1.3);
    const spanY = Math.max(0.1, (maxY - minY) * 1.3);

    const scaleX = w / spanX;
    const scaleY = h / spanY;
    this.viewport.scale = Math.min(scaleX, scaleY);

    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;

    this.viewport.originX = w / 2 - midX * this.viewport.scale;
    this.viewport.originY = h / 2 + midY * this.viewport.scale;
  }

  // --- プリセット管理 ---
  populatePresets() {
    this.dom.presetSelect.innerHTML = '';
    PRESETS.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      this.dom.presetSelect.appendChild(opt);
    });
  }

  loadPreset(presetId) {
    const found = PRESETS.find(p => p.id === presetId);
    if (!found) return;

    this.currentPresetId = presetId;
    this.dom.presetSelect.value = presetId;
    this.config = JSON.parse(JSON.stringify(found));

    this.syncUIFromConfig();
    this.resetSimulation();
    this.fitView();
  }

  // --- UI同期 ---
  syncUIFromConfig() {
    // モード切替
    this.setMode(this.config.mode || 'basic', false);

    // 選択戦略
    const strat = this.config.selectionStrategy || 'uniform';
    this.dom.strategyRadios.forEach(r => {
      r.checked = (r.value === strat);
    });
    this.updateStrategyBadge(strat);

    // パラメータ
    this.dom.paramTotalSteps.value = this.config.totalSteps || 100000;
    this.dom.totalStepsVal.textContent = Number(this.config.totalSteps).toLocaleString();
    this.dom.paramSpeed.value = this.config.speed || 15000;
    this.dom.speedVal.textContent = Number(this.config.speed).toLocaleString();
    this.dom.paramBurnin.value = this.config.burnIn ?? 50;
    this.dom.burninVal.textContent = this.config.burnIn ?? 50;
    this.dom.paramSeed.value = this.config.seed || 'chaos-lab';

    const isRandomInit = this.config.initialPoint?.random !== false;
    this.dom.chkRandomInitial.checked = isRandomInit;
    this.dom.initialCoordInputs.style.display = isRandomInit ? 'none' : 'flex';
    this.dom.paramInitX.value = this.config.initialPoint?.x || 0;
    this.dom.paramInitY.value = this.config.initialPoint?.y || 0;

    // 描画設定
    this.dom.pointSize.value = this.config.pointSize || 1.5;
    this.dom.pointSizeVal.textContent = this.config.pointSize || 1.5;
    this.dom.pointOpacity.value = this.config.pointOpacity || 0.75;
    this.dom.pointOpacityVal.textContent = Math.round((this.config.pointOpacity || 0.75) * 100) + '%';
    
    const colorMode = this.config.colorMode || 'rule';
    this.dom.colorModeRadios.forEach(r => {
      r.checked = (r.value === colorMode);
    });
    this.dom.singleColorPickerGroup.style.display = (colorMode === 'single') ? 'block' : 'none';
    this.dom.singleColor.value = this.config.singleColor || '#00f2fe';

    this.dom.bgColor.value = this.config.bgColor || '#0a0e17';
    this.dom.bgColorHex.textContent = this.config.bgColor || '#0a0e17';

    // ルール & ターゲットリスト再構築
    this.renderRulesList();
    this.renderTargetsList();
  }

  setMode(mode, triggerReset = true) {
    this.config.mode = mode;
    const isBasic = (mode === 'basic');

    this.dom.btnModeBasic.classList.toggle('active', isBasic);
    this.dom.btnModeBasic.setAttribute('aria-selected', isBasic);
    this.dom.btnModeAffine.classList.toggle('active', !isBasic);
    this.dom.btnModeAffine.setAttribute('aria-selected', !isBasic);

    if (this.dom.btnSidebarModeBasic) {
      this.dom.btnSidebarModeBasic.classList.toggle('active', isBasic);
    }
    if (this.dom.btnSidebarModeAffine) {
      this.dom.btnSidebarModeAffine.classList.toggle('active', !isBasic);
    }

    this.dom.basicRulesSection.style.display = isBasic ? 'block' : 'none';
    this.dom.affineRulesSection.style.display = isBasic ? 'none' : 'block';
    this.dom.tabBtnTargets.style.display = isBasic ? 'flex' : 'none';

    if (triggerReset) {
      this.resetSimulation();
      this.fitView();
    }
  }

  showToast(message, type = 'info') {
    if (!this.dom.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    this.dom.toastContainer.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 3000);
  }

  updateStrategyBadge(strategy) {
    const textMap = {
      uniform: '均等ランダム',
      weighted: '確率指定',
      sequence: '順番に実行'
    };
    this.dom.strategyBadge.textContent = textMap[strategy] || strategy;
  }

  // --- ルールリストのDOM生成 ---
  renderRulesList() {
    // 基本ルール
    this.dom.basicRulesList.innerHTML = '';
    const rules = this.config.rules || [];

    rules.forEach((rule, idx) => {
      const card = document.createElement('div');
      card.className = 'rule-card';
      card.style.borderLeftColor = rule.color || '#00f2fe';

      const targetOptions = (this.config.targets || []).map((t, tIdx) => {
        const isSelected = (rule.targetIndex === tIdx || rule.targetId === t.id);
        return `<option value="${tIdx}" ${isSelected ? 'selected' : ''}>ターゲット ${t.name}</option>`;
      }).join('');

      card.innerHTML = `
        <div class="card-top">
          <div class="card-title-group">
            <span class="color-dot" style="background:${rule.color || '#00f2fe'}"></span>
            <input type="text" class="card-title-input rule-name-input" value="${rule.name || 'ルール ' + (idx + 1)}">
          </div>
          <button class="btn-remove btn-del-rule" title="削除">✕</button>
        </div>
        <div class="card-fields">
          <div class="field-group">
            <label>移動方式</label>
            <select class="rule-type-select">
              <option value="target" ${rule.type === 'target' ? 'selected' : ''}>ターゲットへ接近</option>
              <option value="center" ${rule.type === 'center' ? 'selected' : ''}>中心へ接近</option>
              <option value="translate" ${rule.type === 'translate' ? 'selected' : ''}>平行移動</option>
              <option value="rotate" ${rule.type === 'rotate' ? 'selected' : ''}>回転移動</option>
              <option value="scale" ${rule.type === 'scale' ? 'selected' : ''}>拡大・縮小</option>
              <option value="random" ${rule.type === 'random' ? 'selected' : ''}>ランダム移動</option>
            </select>
          </div>
          <div class="field-group field-target-select" style="${rule.type === 'target' ? '' : 'display:none;'}">
            <label>対象</label>
            <select class="rule-target-select">${targetOptions}</select>
          </div>
          <div class="field-group field-ratio" style="${rule.type === 'target' || rule.type === 'center' ? '' : 'display:none;'}">
            <label>移動率 % (0-100)</label>
            <input type="number" class="rule-ratio-input" min="0" max="100" step="1" value="${Math.round((rule.ratio ?? 0.5) * 100)}">
          </div>
          <div class="field-group field-angle" style="${rule.type === 'rotate' ? '' : 'display:none;'}">
            <label>回転角 (°)</label>
            <input type="number" class="rule-angle-input" step="5" value="${rule.angle ?? 45}">
          </div>
          <div class="field-group field-translate" style="${rule.type === 'translate' ? '' : 'display:none;'}">
            <label>dx, dy</label>
            <div style="display:flex;gap:4px;">
              <input type="number" class="rule-dx-input" step="0.1" value="${rule.dx ?? 0.1}" style="width:50%;">
              <input type="number" class="rule-dy-input" step="0.1" value="${rule.dy ?? 0.1}" style="width:50%;">
            </div>
          </div>
          <div class="field-group field-scale" style="${rule.type === 'scale' ? '' : 'display:none;'}">
            <label>倍率</label>
            <input type="number" class="rule-scale-input" step="0.1" value="${rule.scale ?? 0.5}">
          </div>
          <div class="field-group">
            <label>確率 / 重み</label>
            <input type="number" class="rule-weight-input" min="0" step="1" value="${rule.weight ?? 1}">
          </div>
          <div class="field-group">
            <label>描画色</label>
            <input type="color" class="rule-color-input color-picker" value="${rule.color || '#00f2fe'}">
          </div>
        </div>
      `;

      // イベントバインド
      card.querySelector('.rule-name-input').addEventListener('input', (e) => {
        rule.name = e.target.value;
      });
      card.querySelector('.rule-type-select').addEventListener('change', (e) => {
        rule.type = e.target.value;
        this.renderRulesList();
        this.notifyConfigUpdated();
      });
      const targetSelect = card.querySelector('.rule-target-select');
      if (targetSelect) {
        targetSelect.addEventListener('change', (e) => {
          rule.targetIndex = Number(e.target.value);
          this.notifyConfigUpdated();
        });
      }
      const ratioInput = card.querySelector('.rule-ratio-input');
      if (ratioInput) {
        ratioInput.addEventListener('input', (e) => {
          rule.ratio = Number(e.target.value) / 100;
          this.notifyConfigUpdated();
        });
      }
      const weightInput = card.querySelector('.rule-weight-input');
      if (weightInput) {
        weightInput.addEventListener('input', (e) => {
          rule.weight = Number(e.target.value);
          this.notifyConfigUpdated();
        });
      }
      const colorInput = card.querySelector('.rule-color-input');
      if (colorInput) {
        colorInput.addEventListener('input', (e) => {
          rule.color = e.target.value;
          card.style.borderLeftColor = e.target.value;
          card.querySelector('.color-dot').style.background = e.target.value;
          this.notifyConfigUpdated();
        });
      }
      card.querySelector('.btn-del-rule').addEventListener('click', () => {
        this.config.rules.splice(idx, 1);
        this.renderRulesList();
        this.notifyConfigUpdated();
      });

      this.dom.basicRulesList.appendChild(card);
    });

    // アフィン変換ルール
    this.dom.affineRulesList.innerHTML = '';
    const affineRules = this.config.affineRules || [];

    affineRules.forEach((rule, idx) => {
      const card = document.createElement('div');
      card.className = 'rule-card';
      card.style.borderLeftColor = rule.color || '#10b981';

      card.innerHTML = `
        <div class="card-top">
          <div class="card-title-group">
            <span class="color-dot" style="background:${rule.color || '#10b981'}"></span>
            <input type="text" class="card-title-input af-name-input" value="${rule.name || '変換 ' + (idx + 1)}">
          </div>
          <button class="btn-remove btn-del-af" title="削除">✕</button>
        </div>
        <div class="affine-matrix-grid">
          <div class="affine-param-cell"><span>a</span><input type="number" step="0.01" class="af-a" value="${rule.a ?? 0}"></div>
          <div class="affine-param-cell"><span>b</span><input type="number" step="0.01" class="af-b" value="${rule.b ?? 0}"></div>
          <div class="affine-param-cell"><span>e</span><input type="number" step="0.01" class="af-e" value="${rule.e ?? 0}"></div>
          <div class="affine-param-cell"><span>c</span><input type="number" step="0.01" class="af-c" value="${rule.c ?? 0}"></div>
          <div class="affine-param-cell"><span>d</span><input type="number" step="0.01" class="af-d" value="${rule.d ?? 0}"></div>
          <div class="affine-param-cell"><span>f</span><input type="number" step="0.01" class="af-f" value="${rule.f ?? 0}"></div>
        </div>
        <div class="card-fields">
          <div class="field-group">
            <label>確率 / 重み</label>
            <input type="number" class="af-weight" min="0" step="1" value="${rule.weight ?? 1}">
          </div>
          <div class="field-group">
            <label>描画色</label>
            <input type="color" class="af-color color-picker" value="${rule.color || '#10b981'}">
          </div>
        </div>
      `;

      card.querySelector('.af-name-input').addEventListener('input', (e) => { rule.name = e.target.value; });
      ['a', 'b', 'c', 'd', 'e', 'f'].forEach(param => {
        card.querySelector(`.af-${param}`).addEventListener('input', (e) => {
          rule[param] = Number(e.target.value);
          this.notifyConfigUpdated();
        });
      });
      card.querySelector('.af-weight').addEventListener('input', (e) => {
        rule.weight = Number(e.target.value);
        this.notifyConfigUpdated();
      });
      card.querySelector('.af-color').addEventListener('input', (e) => {
        rule.color = e.target.value;
        card.style.borderLeftColor = e.target.value;
        card.querySelector('.color-dot').style.background = e.target.value;
        this.notifyConfigUpdated();
      });
      card.querySelector('.btn-del-af').addEventListener('click', () => {
        this.config.affineRules.splice(idx, 1);
        this.renderRulesList();
        this.notifyConfigUpdated();
      });

      this.dom.affineRulesList.appendChild(card);
    });
  }

  // --- ターゲットリストのDOM生成 ---
  renderTargetsList() {
    this.dom.targetsList.innerHTML = '';
    const targets = this.config.targets || [];

    targets.forEach((t, idx) => {
      const card = document.createElement('div');
      card.className = 'target-card';
      card.style.borderLeftColor = t.color || '#00f2fe';

      card.innerHTML = `
        <div class="card-top">
          <div class="card-title-group">
            <span class="color-dot" style="background:${t.color || '#00f2fe'}"></span>
            <input type="text" class="card-title-input tg-name" value="${t.name || String.fromCharCode(65 + idx)}">
          </div>
          <button class="btn-remove btn-del-tg" title="削除">✕</button>
        </div>
        <div class="card-fields">
          <div class="field-group">
            <label>X座標</label>
            <input type="number" step="0.05" class="tg-x" value="${t.x}">
          </div>
          <div class="field-group">
            <label>Y座標</label>
            <input type="number" step="0.05" class="tg-y" value="${t.y}">
          </div>
          <div class="field-group">
            <label>カラー</label>
            <input type="color" class="tg-color color-picker" value="${t.color || '#00f2fe'}">
          </div>
        </div>
      `;

      card.querySelector('.tg-name').addEventListener('input', (e) => {
        t.name = e.target.value;
        this.renderRulesList(); // ルール側のターゲット名表示も同期
      });
      card.querySelector('.tg-x').addEventListener('input', (e) => {
        t.x = Number(e.target.value);
        this.notifyConfigUpdated();
      });
      card.querySelector('.tg-y').addEventListener('input', (e) => {
        t.y = Number(e.target.value);
        this.notifyConfigUpdated();
      });
      card.querySelector('.tg-color').addEventListener('input', (e) => {
        t.color = e.target.value;
        card.style.borderLeftColor = e.target.value;
        card.querySelector('.color-dot').style.background = e.target.value;
      });
      card.querySelector('.btn-del-tg').addEventListener('click', () => {
        this.config.targets.splice(idx, 1);
        this.renderTargetsList();
        this.renderRulesList();
        this.notifyConfigUpdated();
      });

      this.dom.targetsList.appendChild(card);
    });
  }

  notifyConfigUpdated() {
    if (this.useWorker && this.worker) {
      this.worker.postMessage({ type: 'updateConfig', config: this.config });
    } else if (this.fallbackEngine) {
      this.fallbackEngine.setConfig(this.config);
    }
  }

  // --- シミュレーション制御 ---
  startSimulation() {
    if (this.simState === 'running') return;

    // バリデーション: ルール存在チェック
    const isAffine = this.config.mode === 'affine';
    const activeRules = isAffine ? this.config.affineRules : this.config.rules;
    if (!activeRules || activeRules.length === 0) {
      this.showToast('移動ルールが登録されていません。ルールを追加してください。', 'error');
      return;
    }

    // 基本モードの場合、ターゲットが必要なルールがあるときはターゲット存在チェック
    if (!isAffine) {
      const needsTarget = activeRules.some(r => r.type === 'target');
      if (needsTarget && (!this.config.targets || this.config.targets.length === 0)) {
        this.showToast('ターゲットが設定されていません。ターゲットを追加してください。', 'error');
        return;
      }
    }

    // 仕様要件: 「すべての確率が0の場合はエラーを表示する」
    if (this.config.selectionStrategy === 'weighted') {
      const totalWeight = activeRules.reduce((sum, r) => sum + Math.max(0, Number(r.weight) || 0), 0);
      if (totalWeight <= 0) {
        this.showToast('エラー: すべての確率が0です。いずれかのルールに正の確率を設定してください。', 'error');
        return;
      }
    }

    if (this.simState === 'finished') {
      this.resetSimulation();
    }

    if (this.useWorker && this.worker) {
      if (this.simState === 'idle') {
        this.worker.postMessage({ type: 'init', config: this.config });
        this.worker.postMessage({ type: 'start' });
      } else if (this.simState === 'paused' || this.simState === 'stopped') {
        this.worker.postMessage({ type: 'resume' });
      }
    } else {
      // フォールバック
      if (this.simState === 'idle') {
        this.fallbackEngine = new SimulationEngine(this.config);
      }
      this.startFallbackLoop();
    }

    this.setSimState('running');
  }

  pauseSimulation() {
    if (this.simState !== 'running') return;

    if (this.useWorker && this.worker) {
      this.worker.postMessage({ type: 'pause' });
    } else {
      if (this.fallbackTimer) cancelAnimationFrame(this.fallbackTimer);
    }

    this.setSimState('paused');
  }

  stopSimulation() {
    if (this.useWorker && this.worker) {
      this.worker.postMessage({ type: 'stop' });
    } else {
      if (this.fallbackTimer) cancelAnimationFrame(this.fallbackTimer);
    }

    this.setSimState('stopped');
  }

  resetSimulation() {
    this.stopSimulation();

    if (this.useWorker && this.worker) {
      this.worker.postMessage({ type: 'init', config: this.config });
      this.worker.postMessage({ type: 'reset' });
    } else {
      if (this.fallbackEngine) {
        this.fallbackEngine.reset();
        this.currentPoint = this.fallbackEngine.currentPoint;
      }
    }

    this.currentStep = 0;
    this.clearPointsCanvas();
    this.setSimState('idle');
    this.updateHUD();
  }

  stepOnce() {
    if (this.simState === 'running') {
      this.pauseSimulation();
    }

    if (this.useWorker && this.worker) {
      if (this.simState === 'idle') {
        this.worker.postMessage({ type: 'init', config: this.config });
      }
      this.worker.postMessage({ type: 'step' });
    } else {
      if (!this.fallbackEngine || this.simState === 'idle') {
        this.fallbackEngine = new SimulationEngine(this.config);
      }
      const pt = this.fallbackEngine.step(true);
      if (pt) {
        this.renderPointsBatch([pt]);
        this.currentPoint = { x: pt.x, y: pt.y };
        this.lastRule = { name: pt.ruleName, color: pt.color };
        this.currentStep = this.fallbackEngine.currentStep;
        this.updateHUD();
        if (this.currentStep >= this.config.totalSteps) {
          this.setSimState('finished');
        }
      }
    }

    if (this.simState === 'idle') {
      this.setSimState('paused');
    }
  }

  startFallbackLoop() {
    let lastTime = performance.now();
    const loop = () => {
      if (this.simState !== 'running') return;
      const now = performance.now();
      const delta = Math.min(now - lastTime, 50);
      lastTime = now;

      const speed = Number(this.config.speed) || 15000;
      const count = Math.max(10, Math.min(5000, Math.round((speed * delta) / 1000)));

      const result = this.fallbackEngine.stepBatch(count);
      if (result.points.length > 0) {
        this.renderPointsBatch(result.points);
        this.currentStep = result.currentStep;
        const last = result.points[result.points.length - 1];
        this.currentPoint = { x: last.x, y: last.y };
        this.lastRule = { name: last.ruleName, color: last.color };
        this.updateSpeedMetrics(result.points.length);
        this.updateHUD();
      }

      if (result.isFinished) {
        this.setSimState('finished');
        return;
      }

      this.fallbackTimer = requestAnimationFrame(loop);
    };
    this.fallbackTimer = requestAnimationFrame(loop);
  }

  setSimState(newState) {
    this.simState = newState;

    const isRunning = (newState === 'running');
    const isPaused = (newState === 'paused');
    const isStopped = (newState === 'stopped' || newState === 'finished');

    this.dom.btnStart.disabled = isRunning;
    this.dom.btnPause.disabled = !isRunning;
    this.dom.btnStop.disabled = (newState === 'idle' || isStopped);
    this.dom.btnStep.disabled = isRunning;

    if (isRunning) {
      this.dom.btnStartLabel.textContent = '実行中...';
      this.dom.btnStart.classList.add('active');
    } else if (isPaused) {
      this.dom.btnStartLabel.textContent = '再開';
      this.dom.btnStart.classList.remove('active');
    } else {
      this.dom.btnStartLabel.textContent = '開始';
      this.dom.btnStart.classList.remove('active');
    }
  }

  updateSpeedMetrics(pointsAdded) {
    const now = performance.now();
    this.batchPointCount += pointsAdded;
    if (now - this.lastBatchTime >= 500) {
      const deltaSec = (now - this.lastBatchTime) / 1000;
      this.currentSpeedPtsPerSec = Math.round(this.batchPointCount / deltaSec);
      this.batchPointCount = 0;
      this.lastBatchTime = now;
    }
  }

  updateHUD() {
    const total = this.config.totalSteps || 100000;
    const cur = this.currentStep;
    const pct = Math.min(100, (cur / total) * 100);

    this.dom.hudCurrentStep.textContent = cur.toLocaleString();
    this.dom.hudTotalStep.textContent = total.toLocaleString();
    this.dom.hudProgressFill.style.width = `${pct}%`;
    this.dom.hudPercent.textContent = `${pct.toFixed(1)}%`;

    this.dom.hudSpeed.textContent = (this.simState === 'running') 
      ? `${this.currentSpeedPtsPerSec.toLocaleString()} pts/s` 
      : '0 pts/s';

    if (this.lastRule) {
      this.dom.hudRuleName.textContent = this.lastRule.name;
      this.dom.hudRuleDot.style.background = this.lastRule.color;
      this.dom.hudRuleDot.style.boxShadow = `0 0 6px ${this.lastRule.color}`;
    }

    if (this.currentPoint) {
      this.dom.hudCoords.textContent = `(${this.currentPoint.x.toFixed(3)}, ${this.currentPoint.y.toFixed(3)})`;
    }
  }

  // --- JSON保存 & 読み込み ---
  exportJSON() {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(this.config, null, 2));
    const a = document.createElement('a');
    a.setAttribute('href', dataStr);
    a.setAttribute('download', `chaos_lab_${this.config.id || 'experiment'}.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  importJSON(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const loaded = JSON.parse(e.target.result);
        if (!loaded.mode) {
          alert('無効な設定JSONファイルです。');
          return;
        }
        this.config = loaded;
        this.syncUIFromConfig();
        this.resetSimulation();
        this.fitView();
      } catch (err) {
        alert('JSONファイルの解析に失敗しました: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  // --- PNG画像保存 ---
  exportPNG() {
    // 描画用の合成キャンバス作成 (背景 + 点)
    const w = this.dom.pointsCanvas.width;
    const h = this.dom.pointsCanvas.height;
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = w;
    exportCanvas.height = h;
    const eCtx = exportCanvas.getContext('2d');

    // 背景
    eCtx.fillStyle = this.config.bgColor || '#0a0e17';
    eCtx.fillRect(0, 0, w, h);

    // 点Canvasを転送
    eCtx.drawImage(this.dom.pointsCanvas, 0, 0);

    const link = document.createElement('a');
    link.download = `chaos_lab_fractal_${Date.now()}.png`;
    link.href = exportCanvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  // --- イベントバインド ---
  bindEvents() {
    // プリセット
    this.dom.presetSelect.addEventListener('change', (e) => {
      this.loadPreset(e.target.value);
    });

    // モード切替
    this.dom.btnModeBasic.addEventListener('click', () => this.setMode('basic'));
    this.dom.btnModeAffine.addEventListener('click', () => this.setMode('affine'));
    if (this.dom.btnSidebarModeBasic) {
      this.dom.btnSidebarModeBasic.addEventListener('click', () => this.setMode('basic'));
    }
    if (this.dom.btnSidebarModeAffine) {
      this.dom.btnSidebarModeAffine.addEventListener('click', () => this.setMode('affine'));
    }

    // JSON / PNG
    this.dom.btnExportJson.addEventListener('click', () => this.exportJSON());
    this.dom.btnImportJson.addEventListener('click', () => this.dom.fileInputJson.click());
    this.dom.fileInputJson.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        this.importJSON(e.target.files[0]);
      }
    });
    this.dom.btnExportPng.addEventListener('click', () => this.exportPNG());

    // サイドバー & ドロワー
    this.dom.btnToggleSidebar.addEventListener('click', () => {
      this.dom.sidebar.classList.toggle('open');
      this.dom.sidebarBackdrop.classList.toggle('active');
    });
    this.dom.sidebarBackdrop.addEventListener('click', () => {
      this.dom.sidebar.classList.remove('open');
      this.dom.sidebarBackdrop.classList.remove('active');
    });

    // サイドバータブ切り替え
    this.dom.sidebarTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        this.dom.sidebarTabs.forEach(t => t.classList.remove('active'));
        this.dom.tabPanes.forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        const targetPane = document.getElementById(tab.dataset.tab);
        if (targetPane) targetPane.classList.add('active');
      });
    });

    // ルール選択方式
    this.dom.strategyRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.config.selectionStrategy = e.target.value;
        this.updateStrategyBadge(e.target.value);
        this.notifyConfigUpdated();
      });
    });

    // ルール追加ボタン
    this.dom.btnAddBasicRule.addEventListener('click', () => {
      const newRule = {
        id: `r_${Date.now()}`,
        name: `ルール ${(this.config.rules?.length || 0) + 1}`,
        type: 'target',
        targetIndex: 0,
        ratio: 0.5,
        weight: 1,
        color: '#00f2fe'
      };
      if (!this.config.rules) this.config.rules = [];
      this.config.rules.push(newRule);
      this.renderRulesList();
      this.notifyConfigUpdated();
    });

    this.dom.btnAddAffineRule.addEventListener('click', () => {
      const newAffine = {
        id: `af_${Date.now()}`,
        name: `変換 ${(this.config.affineRules?.length || 0) + 1}`,
        a: 0.5, b: 0, c: 0, d: 0.5, e: 0, f: 0,
        weight: 1,
        color: '#10b981'
      };
      if (!this.config.affineRules) this.config.affineRules = [];
      this.config.affineRules.push(newAffine);
      this.renderRulesList();
      this.notifyConfigUpdated();
    });

    // ターゲット正多角形生成
    const updatePolyLabels = () => {
      this.dom.polyNVal.textContent = this.dom.polyN.value;
      this.dom.polyRVal.textContent = this.dom.polyR.value;
      this.dom.polyRotVal.textContent = `${this.dom.polyRot.value}°`;
    };
    this.dom.polyN.addEventListener('input', updatePolyLabels);
    this.dom.polyR.addEventListener('input', updatePolyLabels);
    this.dom.polyRot.addEventListener('input', updatePolyLabels);

    this.dom.btnGeneratePoly.addEventListener('click', () => {
      const n = Number(this.dom.polyN.value);
      const r = Number(this.dom.polyR.value);
      const rot = Number(this.dom.polyRot.value);
      this.config.targets = generateRegularPolygon(n, r, 0, 0, rot);

      // ルールがターゲットを参照している場合は整合性維持
      if (this.config.rules) {
        this.config.rules.forEach(rule => {
          if (rule.targetIndex >= n) rule.targetIndex = 0;
        });
      }

      this.renderTargetsList();
      this.renderRulesList();
      this.resetSimulation();
      this.fitView();
    });

    this.dom.btnAddTarget.addEventListener('click', () => {
      const n = this.config.targets?.length || 0;
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const label = n < alphabet.length ? alphabet[n] : `T${n + 1}`;
      const hue = Math.round((360 * n) / Math.max(1, n + 1));

      this.config.targets.push({
        id: `t_${Date.now()}`,
        name: label,
        x: Number(((Math.random() - 0.5) * 1.5).toFixed(3)),
        y: Number(((Math.random() - 0.5) * 1.5).toFixed(3)),
        color: `hsl(${hue}, 85%, 60%)`
      });

      this.renderTargetsList();
      this.renderRulesList();
      this.notifyConfigUpdated();
    });

    // パラメータ
    this.dom.paramTotalSteps.addEventListener('input', (e) => {
      this.config.totalSteps = Number(e.target.value);
      this.dom.totalStepsVal.textContent = Number(e.target.value).toLocaleString();
      this.notifyConfigUpdated();
      this.updateHUD();
    });

    this.dom.stepChips.forEach(chip => {
      chip.addEventListener('click', () => {
        this.dom.stepChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const steps = Number(chip.dataset.steps);
        this.dom.paramTotalSteps.value = steps;
        this.config.totalSteps = steps;
        this.dom.totalStepsVal.textContent = steps.toLocaleString();
        this.notifyConfigUpdated();
        this.updateHUD();
      });
    });

    this.dom.paramSpeed.addEventListener('input', (e) => {
      this.config.speed = Number(e.target.value);
      this.dom.speedVal.textContent = Number(e.target.value).toLocaleString();
      if (this.useWorker && this.worker) {
        this.worker.postMessage({ type: 'setSpeed', speed: this.config.speed });
      } else {
        this.notifyConfigUpdated();
      }
    });

    this.dom.paramBurnin.addEventListener('change', (e) => {
      this.config.burnIn = Number(e.target.value);
      this.dom.burninVal.textContent = e.target.value;
      this.notifyConfigUpdated();
    });

    this.dom.chkRandomInitial.addEventListener('change', (e) => {
      if (!this.config.initialPoint) this.config.initialPoint = {};
      this.config.initialPoint.random = e.target.checked;
      this.dom.initialCoordInputs.style.display = e.target.checked ? 'none' : 'flex';
      this.notifyConfigUpdated();
    });

    this.dom.paramInitX.addEventListener('input', (e) => {
      if (!this.config.initialPoint) this.config.initialPoint = {};
      this.config.initialPoint.x = Number(e.target.value);
      this.notifyConfigUpdated();
    });
    this.dom.paramInitY.addEventListener('input', (e) => {
      if (!this.config.initialPoint) this.config.initialPoint = {};
      this.config.initialPoint.y = Number(e.target.value);
      this.notifyConfigUpdated();
    });

    this.dom.paramSeed.addEventListener('input', (e) => {
      this.config.seed = e.target.value;
      this.notifyConfigUpdated();
    });
    this.dom.btnRandomSeed.addEventListener('click', () => {
      const newSeed = 'chaos-' + Math.floor(Math.random() * 1000000);
      this.dom.paramSeed.value = newSeed;
      this.config.seed = newSeed;
      this.resetSimulation();
    });

    // 描画・表示
    this.dom.pointSize.addEventListener('input', (e) => {
      this.config.pointSize = Number(e.target.value);
      this.dom.pointSizeVal.textContent = e.target.value;
    });

    this.dom.pointOpacity.addEventListener('input', (e) => {
      this.config.pointOpacity = Number(e.target.value);
      this.dom.pointOpacityVal.textContent = `${Math.round(e.target.value * 100)}%`;
    });

    this.dom.colorModeRadios.forEach(r => {
      r.addEventListener('change', (e) => {
        this.config.colorMode = e.target.value;
        this.dom.singleColorPickerGroup.style.display = (e.target.value === 'single') ? 'block' : 'none';
      });
    });

    this.dom.singleColor.addEventListener('input', (e) => {
      this.config.singleColor = e.target.value;
    });

    this.dom.bgColor.addEventListener('input', (e) => {
      this.config.bgColor = e.target.value;
      this.dom.bgColorHex.textContent = e.target.value;
      this.clearPointsCanvas();
    });

    this.dom.colorChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const c = chip.dataset.color;
        this.dom.bgColor.value = c;
        this.dom.bgColorHex.textContent = c;
        this.config.bgColor = c;
        this.clearPointsCanvas();
      });
    });

    this.dom.chkShowTargets.addEventListener('change', (e) => {
      this.config.showTargets = e.target.checked;
    });
    this.dom.chkShowCurrentPt.addEventListener('change', (e) => {
      this.config.showCurrentPt = e.target.checked;
    });
    this.dom.chkShowGrid.addEventListener('change', (e) => {
      this.config.showGrid = e.target.checked;
    });

    // シミュレーションコントロールボタン
    this.dom.btnStart.addEventListener('click', () => this.startSimulation());
    this.dom.btnPause.addEventListener('click', () => this.pauseSimulation());
    this.dom.btnStop.addEventListener('click', () => this.stopSimulation());
    this.dom.btnReset.addEventListener('click', () => this.resetSimulation());
    this.dom.btnStep.addEventListener('click', () => this.stepOnce());

    // ビュー操作ボタン
    this.dom.btnZoomIn.addEventListener('click', () => {
      this.zoomAt(this.pointsCanvasWidth / 2, this.pointsCanvasHeight / 2, 1.25);
    });
    this.dom.btnZoomOut.addEventListener('click', () => {
      this.zoomAt(this.pointsCanvasWidth / 2, this.pointsCanvasHeight / 2, 0.8);
    });
    this.dom.btnFitView.addEventListener('click', () => this.fitView());
    this.dom.btnClearCanvas.addEventListener('click', () => this.clearPointsCanvas());

    // Canvas マウス & タッチ操作
    this.bindCanvasInteraction();
  }

  zoomAt(screenX, screenY, factor) {
    const worldBefore = this.screenToWorld(screenX, screenY);
    this.viewport.scale *= factor;
    // 拡大縮小後も同じワールド座標が画面上のscreenX, screenYに留まるように原点を移動
    this.viewport.originX = screenX - worldBefore.x * this.viewport.scale;
    this.viewport.originY = screenY + worldBefore.y * this.viewport.scale;
  }

  bindCanvasInteraction() {
    const container = this.dom.canvasContainer;

    // ターゲットホバー/クリック判定 (近傍 20px)
    const findTargetNearScreen = (sx, sy) => {
      if (this.config.mode !== 'basic' || !this.config.targets) return null;
      for (let t of this.config.targets) {
        const s = this.worldToScreen(t.x, t.y);
        const dist = Math.hypot(s.x - sx, s.y - sy);
        if (dist <= 20) return t;
      }
      return null;
    };

    // マウスホイール (ズーム)
    container.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.15 : 0.87;
      this.zoomAt(sx, sy, factor);
    }, { passive: false });

    // マウスダウン
    container.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // 左クリックのみ
      const rect = container.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      // 「クリックでターゲット追加」モードの場合
      if (this.dom.chkCanvasClickAdd.checked && this.config.mode === 'basic') {
        const wCoord = this.screenToWorld(sx, sy);
        const n = this.config.targets?.length || 0;
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const label = n < alphabet.length ? alphabet[n] : `T${n + 1}`;
        const hue = Math.round((360 * n) / Math.max(1, n + 1));

        this.config.targets.push({
          id: `t_${Date.now()}`,
          name: label,
          x: Number(wCoord.x.toFixed(3)),
          y: Number(wCoord.y.toFixed(3)),
          color: `hsl(${hue}, 85%, 60%)`
        });
        this.renderTargetsList();
        this.renderRulesList();
        this.notifyConfigUpdated();
        return;
      }

      // ターゲットを掴んだか判定
      const target = findTargetNearScreen(sx, sy);
      if (target) {
        this.viewport.dragTarget = target;
        container.classList.add('grabbing');
        return;
      }

      // ビューポートのパン開始
      this.viewport.isDragging = true;
      this.viewport.dragStartX = sx - this.viewport.originX;
      this.viewport.dragStartY = sy - this.viewport.originY;
      container.classList.add('grabbing');
    });

    window.addEventListener('mousemove', (e) => {
      const rect = container.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      if (this.viewport.dragTarget) {
        // ターゲットを移動中
        const wCoord = this.screenToWorld(sx, sy);
        this.viewport.dragTarget.x = Number(wCoord.x.toFixed(3));
        this.viewport.dragTarget.y = Number(wCoord.y.toFixed(3));
        this.notifyConfigUpdated();
        return;
      }

      if (this.viewport.isDragging) {
        // ビューポートをパン中
        this.viewport.originX = sx - this.viewport.dragStartX;
        this.viewport.originY = sy - this.viewport.dragStartY;
      } else {
        // ホバー判定カーソル変更
        const target = findTargetNearScreen(sx, sy);
        if (target) {
          container.style.cursor = 'move';
        } else if (this.dom.chkCanvasClickAdd.checked) {
          container.style.cursor = 'crosshair';
        } else {
          container.style.cursor = 'grab';
        }
      }
    });

    window.addEventListener('mouseup', () => {
      if (this.viewport.dragTarget) {
        this.viewport.dragTarget = null;
        this.renderTargetsList(); // 座標入力欄も同期
      }
      this.viewport.isDragging = false;
      container.classList.remove('grabbing');
    });

    // タッチ操作 (ピンチズーム & 1本指ドラッグ)
    container.addEventListener('touchstart', (e) => {
      const rect = container.getBoundingClientRect();

      if (e.touches.length === 1) {
        const sx = e.touches[0].clientX - rect.left;
        const sy = e.touches[0].clientY - rect.top;

        if (this.dom.chkCanvasClickAdd.checked && this.config.mode === 'basic') {
          const wCoord = this.screenToWorld(sx, sy);
          const n = this.config.targets?.length || 0;
          const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
          const label = n < alphabet.length ? alphabet[n] : `T${n + 1}`;
          this.config.targets.push({
            id: `t_${Date.now()}`,
            name: label,
            x: Number(wCoord.x.toFixed(3)),
            y: Number(wCoord.y.toFixed(3)),
            color: '#00f2fe'
          });
          this.renderTargetsList();
          this.renderRulesList();
          this.notifyConfigUpdated();
          return;
        }

        const target = findTargetNearScreen(sx, sy);
        if (target) {
          this.viewport.dragTarget = target;
          return;
        }

        this.viewport.isDragging = true;
        this.viewport.dragStartX = sx - this.viewport.originX;
        this.viewport.dragStartY = sy - this.viewport.originY;
      } else if (e.touches.length === 2) {
        // ピンチズーム開始
        this.viewport.isDragging = false;
        this.viewport.dragTarget = null;
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        this.viewport.pinchDistance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      }
    }, { passive: false });

    container.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();

      if (e.touches.length === 1) {
        const sx = e.touches[0].clientX - rect.left;
        const sy = e.touches[0].clientY - rect.top;

        if (this.viewport.dragTarget) {
          const wCoord = this.screenToWorld(sx, sy);
          this.viewport.dragTarget.x = Number(wCoord.x.toFixed(3));
          this.viewport.dragTarget.y = Number(wCoord.y.toFixed(3));
          this.notifyConfigUpdated();
          return;
        }

        if (this.viewport.isDragging) {
          this.viewport.originX = sx - this.viewport.dragStartX;
          this.viewport.originY = sy - this.viewport.dragStartY;
        }
      } else if (e.touches.length === 2) {
        // ピンチズーム
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const newDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        if (this.viewport.pinchDistance > 0 && newDist > 0) {
          const factor = newDist / this.viewport.pinchDistance;
          const centerSx = (t1.clientX + t2.clientX) / 2 - rect.left;
          const centerSy = (t1.clientY + t2.clientY) / 2 - rect.top;
          this.zoomAt(centerSx, centerSy, factor);
        }
        this.viewport.pinchDistance = newDist;
      }
    }, { passive: false });

    container.addEventListener('touchend', () => {
      if (this.viewport.dragTarget) {
        this.viewport.dragTarget = null;
        this.renderTargetsList();
      }
      this.viewport.isDragging = false;
      this.viewport.pinchDistance = 0;
    });
  }
}

// アプリケーション起動
window.addEventListener('DOMContentLoaded', () => {
  window.chaosLabApp = new ChaosLabApp();
});
