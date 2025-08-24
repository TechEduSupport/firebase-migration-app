// functions/src/grading.js
'use strict';

const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');
const { ImageAnnotatorClient } = require('@google-cloud/vision');
const { OpenAI } = require('openai');
const { FieldValue } = require('firebase-admin/firestore');

// ---- Admin init ----
try { admin.app(); } catch { admin.initializeApp(); }

// ---- OpenAI ----
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---- Utils ----
function removeMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/[_*~]/g, '')
    .trim();
}

async function ensureFetch() {
  /* eslint-disable no-undef */
  if (typeof fetch !== 'undefined') return fetch;
  /* eslint-enable no-undef */
  const mod = await import('node-fetch');
  return mod.default;
}

/** URL / gs:// / 相対パス → Buffer */
async function fetchImageBytes(pathOrUrl) {
  if (!pathOrUrl) throw new Error('画像の場所が不明（URL/gs:///相対パス）');

  if (pathOrUrl.startsWith('gs://')) {
    const u = new URL(pathOrUrl);
    const [buf] = await admin.storage().bucket(u.host).file(decodeURIComponent(u.pathname.slice(1))).download();
    return buf;
  }
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    const f = await ensureFetch();
    const res = await f(pathOrUrl);
    if (!res.ok) throw new Error(`画像取得失敗: ${res.status} ${res.statusText}`);
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  }
  const [buf] = await admin.storage().bucket().file(pathOrUrl).download();
  return buf;
}

/** Vision: documentTextDetection 優先＋fallback */
async function runOCR(bytes) {
  const client = new ImageAnnotatorClient();
  const [result] = await client.documentTextDetection({
    image: { content: bytes },
    imageContext: { languageHints: ['ja', 'en'] },
  });

  const ocrText =
    (result?.fullTextAnnotation?.text || '').trim() ||
    (Array.isArray(result?.textAnnotations) ? (result.textAnnotations[0]?.description || '').trim() : '') ||
    '';

  const debug = {
    hasFullText: !!result?.fullTextAnnotation,
    firstDescLen: Array.isArray(result?.textAnnotations) ? (result.textAnnotations[0]?.description?.length || 0) : 0,
    apiError: result?.error?.message || 'none',
  };

  if (!ocrText) throw new Error(`Vision OCR が空（hint: ${debug.apiError}）`);
  return { ocrText, debug };
}

/** 「合計点: …」抽出（数値/記号どちらも） */
function extractScore(feedbackPlain) {
  if (!feedbackPlain) return null;
  const m = feedbackPlain.match(/^\s*合計点:\s*(.+)\s*$/m);
  if (!m || !m[1]) return null;
  const raw = m[1].trim();
  const num = parseInt(raw, 10);
  return Number.isNaN(num) ? raw : num;
}

/** 拡張子から簡易MIME判定（画像添付をdata URLで渡す用） */
function detectMime(nameOrPath = '') {
  const lower = (nameOrPath || '').toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

// ---- Firestore Trigger ----
exports.gradeSubmission = onDocumentWritten(
  {
    document: 'submissions/{submissionId}',
    region: 'asia-northeast1',
    timeoutSeconds: 540,
    memory: '1GiB',
  },
  async (event) => {
    const submissionId = event.params.submissionId;

    // キルスイッチ（.env に GRADING_DISABLED=1 で全停止）
    if (process.env.GRADING_DISABLED === '1') {
      logger.warn(`[${submissionId}] GRADING_DISABLED によりスキップ`);
      return null;
    }

    if (!event.data.after.exists) {
      logger.info(`[${submissionId}] 削除イベントのためスキップ`);
      return null;
    }

    const after = event.data.after.data();
    const before = event.data.before?.exists ? event.data.before.data() : null;
    const submissionRef = event.data.after.ref;

    // ---- 差分ガード：回答が新規 or 変更された時のみ実行 ----
    const isCreated = !before;
    const answerChanged =
      isCreated ||
      before?.textAnswer !== after?.textAnswer ||
      before?.answerImageUrl !== after?.answerImageUrl ||
      before?.answerVersion !== after?.answerVersion; // ← クライアントで increment 推奨

    if (!answerChanged) {
      logger.info(`[${submissionId}] 回答の新規/変更なしのためスキップ`);
      return null;
    }

    // 既にスコアがあるならスキップ（再採点は別フローで）
    if (after?.score != null) {
      logger.info(`[${submissionId}] score が存在するためスキップ`);
      return null;
    }

    try {
      if (!after?.promptId) throw new Error('promptId が空です');

      const promptSnap = await admin.firestore().collection('prompts').doc(after.promptId).get();
      if (!promptSnap.exists) throw new Error(`prompts/${after.promptId} が見つかりません`);
      const promptData = promptSnap.data();

      // ---- 解答案の用意 ----
      let ocrText = '';
      let studentAnswerText = '';

      if (after?.textAnswer && after.textAnswer.trim() !== '') {
        studentAnswerText = after.textAnswer.trim();
        logger.info(`[${submissionId}] テキスト解答を処理`);
      } else if (after?.answerImageUrl) {
        logger.info(`[${submissionId}] 画像解答を処理: ${after.answerImageUrl}`);

        // Vision OCR（bytes）
        const bytes = await fetchImageBytes(after.answerImageUrl);
        const { ocrText: extracted, debug } = await runOCR(bytes);
        ocrText = extracted;
        logger.info(
          `[${submissionId}] Vision OCR 完了 len=${ocrText.length}, fullText=${debug.hasFullText}, text0len=${debug.firstDescLen}, err=${debug.apiError}`
        );

        // --- 文字起こしプロンプト ---
        const transcriptionPrompt = `
次の手書き文字を文字起こししてください。

- **スペリング**：***誤字の補正は絶対に行わず***、以下の OCR 結果のスペリングをそのまま使ってください。
- **文脈と構造**：不要な改行を可能な範囲で除去し、自然に読めるよう並べてください（句読点の補助は可、語の綴りは変更不可）。

OCR結果:
\`\`\`
${ocrText}
\`\`\`
        `.trim();

        // --- bytes→base64→data URL で画像を添付（公開URL不要・本番鍵付きOK） ---
        const mime = detectMime(after.answerImageUrl);
        const base64 = bytes.toString('base64');

        const content = [
          { type: 'text', text: transcriptionPrompt },
          { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } }
        ];

        const transcriptionResponse = await openai.chat.completions.create({
          model: 'gpt-4o-2024-11-20', // ★OCR整形用モデル（指定どおり）
          messages: [{ role: 'user', content }],
          max_tokens: 15000,          // ★常に 15000
          temperature: 0,
        });

        // 文字起こし結果を採用（失敗時はOCR生テキストを使用）
        studentAnswerText = transcriptionResponse.choices?.[0]?.message?.content?.trim() || ocrText;
        logger.info(`[${submissionId}] GPT-4o 整形完了 len=${studentAnswerText.length}`);
      } else {
        logger.info(`[${submissionId}] 解答テキスト/画像なし → スキップ`);
        return null;
      }

      // ---- 採点 ----
      const gradingPrompt = `
次の文章は、答案用紙をOCRで書き起こしたものです。
正解・採点基準・配点に従って採点してください。日本人の生徒向けに丁寧に解説してください。
（採点基準内に別段の指示があればそれを優先してください。）

・"I'm sorry, but I can't assist with that" 等が含まれていれば文字起こし失敗の可能性があります。
・全く関係のない内容なら採点を行わず、その旨を伝えてください。

【採点基準】:
${promptData.subject}

【問題文】:
${promptData.question || '（問題文なし）'}

【生徒の答案】:
${studentAnswerText}

必ず最後に **「合計点: ●●」** という行を1行だけ入れてください。
数値の場合は「点」を付けないでください。数値以外（A～C等）の場合もその評価をそのまま記載してください。
      `.trim();

      // ★ 採点は GPT-5-2025-08-07 / フラットパラメータ / 15,000 tokens
      const gradingResponse = await openai.chat.completions.create({
        model: 'gpt-5-2025-08-07',
        messages: [{ role: 'user', content: gradingPrompt }],
        max_completion_tokens: 15000, 
        reasoning_effort: 'medium',
        verbosity: 'medium'
      });

      const raw = gradingResponse.choices?.[0]?.message?.content?.trim() || '';
      const cleaned = removeMarkdown(raw);
      let score = extractScore(cleaned);

      if (score == null) {
        // 末尾が数値単独なら拾う軽いフォールバック
        const lines = cleaned.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        const last = lines[lines.length - 1] || '';
        const m = last.match(/^(\d{1,3})$/);
        if (m) score = parseInt(m[1], 10);
      }

      logger.info(`[${submissionId}] 採点完了 score=${score}`);

      // ---- 単発書き込み（これで再トリガーしても差分なしで即スキップ）----
      await submissionRef.set({
        ocrText: ocrText || null,
        transcription: studentAnswerText || null,
        feedback: cleaned,
        score: score ?? null,
        status: 'graded',
        gradedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      logger.info(`[${submissionId}] 採点プロセス完了（単発書き込み）`);
      return null;
    } catch (err) {
      logger.error(`[${submissionId}] 採点中エラー: ${err?.message}`, err);
      await submissionRef.set({
        status: 'error',
        error: { message: err?.message || String(err), name: err?.name || 'Error' },
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      return null;
    }
  }
);
