'use strict';
const { failure } = require('./analyze-kol.cjs');
async function generateGemini(prompt, { apiKey, model, fetchImpl = fetch } = {}) {
  if (!apiKey || !model || !/^gemini-[a-zA-Z0-9.-]+$/.test(model)) {
    throw failure('failed-precondition', 'AI server configuration is incomplete.');
  }
  try {
    const response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.35, maxOutputTokens: 1100 } }),
      signal: AbortSignal.timeout(25000)
    });
    if (!response.ok) throw new Error('provider failure');
    // Bound the response before JSON parsing; never forward provider error bodies.
    let length = 0;
    const chunks = [];
    for await (const chunk of response.body) {
      length += chunk.byteLength;
      if (length > 65536) { await response.body.cancel().catch(() => {}); throw new Error('response limit'); }
      chunks.push(Buffer.from(chunk));
    }
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const text = body.candidates?.[0]?.content?.parts?.filter(part => typeof part.text === 'string' && !part.thought).map(part => part.text).join('\n');
    if (!text?.trim() || Buffer.byteLength(text, 'utf8') > 16384) throw new Error('empty or oversized response');
    return text;
  } catch {
    throw failure('unavailable', 'AI service unavailable. No analysis was generated.');
  }
}
module.exports = { generateGemini };
