/**
 * CHAOS LAB - Web Worker スレッド (worker.js)
 * フラクタル計算をUIスレッドから分離し、高速・滑らかなレンダリングを実現
 */

import { SimulationEngine } from './simulation.js';

let engine = null;
let isRunning = false;
let isPaused = false;
let loopTimer = null;
let targetSpeed = 10000; // pts/sec
let lastTimestamp = 0;

function scheduleNextBatch() {
  if (!isRunning || isPaused || !engine) return;

  const now = performance.now();
  const deltaMs = lastTimestamp ? Math.min(now - lastTimestamp, 50) : 16;
  lastTimestamp = now;

  // 経過時間に応じたバッチ点数の計算
  // 最小 10 点、最大 10,000 点/フレーム
  const pointsToCompute = Math.max(10, Math.min(10000, Math.round((targetSpeed * deltaMs) / 1000)));

  const result = engine.stepBatch(pointsToCompute);

  if (result.points.length > 0) {
    self.postMessage({
      type: 'batch',
      points: result.points,
      currentStep: result.currentStep,
      totalSteps: engine.config.totalSteps,
      isFinished: result.isFinished
    });
  }

  if (result.isFinished) {
    isRunning = false;
    isPaused = false;
    self.postMessage({
      type: 'finished',
      currentStep: result.currentStep,
      totalSteps: engine.config.totalSteps
    });
    return;
  }

  // 次のフレームまたは短いタイマーで継続
  loopTimer = setTimeout(scheduleNextBatch, 8);
}

self.onmessage = function(e) {
  const { type, config, speed } = e.data;

  switch (type) {
    case 'init':
      if (loopTimer) clearTimeout(loopTimer);
      isRunning = false;
      isPaused = false;
      engine = new SimulationEngine(config);
      targetSpeed = config.speed || 10000;
      self.postMessage({
        type: 'initialized',
        currentPoint: engine.currentPoint,
        burnIn: engine.config.burnIn,
        totalSteps: engine.config.totalSteps
      });
      break;

    case 'start':
      if (!engine) return;
      if (loopTimer) clearTimeout(loopTimer);
      isRunning = true;
      isPaused = false;
      lastTimestamp = performance.now();
      scheduleNextBatch();
      self.postMessage({ type: 'statusChanged', status: 'running' });
      break;

    case 'pause':
      isRunning = false;
      isPaused = true;
      if (loopTimer) clearTimeout(loopTimer);
      self.postMessage({ type: 'statusChanged', status: 'paused', currentStep: engine ? engine.currentStep : 0 });
      break;

    case 'resume':
      if (!engine) return;
      if (engine.currentStep >= engine.config.totalSteps) return;
      if (loopTimer) clearTimeout(loopTimer);
      isRunning = true;
      isPaused = false;
      lastTimestamp = performance.now();
      scheduleNextBatch();
      self.postMessage({ type: 'statusChanged', status: 'running' });
      break;

    case 'stop':
      isRunning = false;
      isPaused = false;
      if (loopTimer) clearTimeout(loopTimer);
      self.postMessage({ type: 'statusChanged', status: 'stopped', currentStep: engine ? engine.currentStep : 0 });
      break;

    case 'reset':
      isRunning = false;
      isPaused = false;
      if (loopTimer) clearTimeout(loopTimer);
      if (engine) {
        engine.reset();
        self.postMessage({
          type: 'resetDone',
          currentPoint: engine.currentPoint,
          currentStep: 0,
          totalSteps: engine.config.totalSteps
        });
      }
      break;

    case 'step':
      if (!engine) return;
      if (engine.currentStep >= engine.config.totalSteps) {
        self.postMessage({ type: 'finished', currentStep: engine.currentStep });
        return;
      }
      const pt = engine.step(true);
      self.postMessage({
        type: 'stepResult',
        point: pt,
        currentStep: engine.currentStep,
        totalSteps: engine.config.totalSteps,
        isFinished: engine.currentStep >= engine.config.totalSteps
      });
      break;

    case 'setSpeed':
      if (speed && speed > 0) {
        targetSpeed = speed;
        if (engine) engine.config.speed = speed;
      }
      break;

    case 'updateConfig':
      if (config && engine) {
        // 設定更新
        const wasRunning = isRunning;
        if (loopTimer) clearTimeout(loopTimer);
        engine.setConfig(config);
        targetSpeed = config.speed || targetSpeed;
        if (wasRunning) {
          lastTimestamp = performance.now();
          scheduleNextBatch();
        }
      }
      break;

    default:
      console.warn('[Worker] Unknown message type:', type);
  }
};
