'use strict';

const SYSTEM_PROMPT = `You are an expert geotechnical and civil engineer specializing in structural inspection, slope stability, and retaining anchors. Analyze the provided site image for pathologies such as corrosion, tension cracks, concrete spalling, drainage failure, or slope movement. Return your response STRICTLY as a valid flat JSON object containing exactly these keys:
- "elemento": The structural element analyzed (e.g., "Anchored soil slope", "Concrete retaining wall").
- "patologia": A technical description of the observed defect or damage.
- "severidad": Severity rating ("Low", "Medium", "High", or "Critical").
- "porcentaje": Estimated percentage of the affected surface area (number only, e.g., 15).
- "recomendacion": Recommended corrective geotechnical or structural action.
Do not include any markdown formatting blocks like \`\`\`json or additional conversational text, just output the raw JSON object.`;

const VALID_SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];

function parseDataUrl(input, fallbackMime) {
  const str = String(input || '').trim();
  const match = str.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (match) {
    return { mediaType: match[1], data: match[2] };
  }
  return { mediaType: fallbackMime || 'image/jpeg', data: str };
}

function normalizeAgentJson(rawText) {
  const cleaned = String(rawText || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (_) {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      parsed = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
    } else {
      throw new Error('Invalid JSON returned by vision model');
    }
  }

  const sevRaw = String(parsed.severidad || 'Medium').trim();
  const severidad =
    VALID_SEVERITIES.find(s => s.toLowerCase() === sevRaw.toLowerCase()) ||
    'Medium';

  const pctNum = Number(
    String(parsed.porcentaje ?? 0).replace(/[^0-9.+-]/g, '')
  );
  const porcentaje = Number.isFinite(pctNum)
    ? Math.max(0, Math.min(100, Math.round(pctNum)))
    : 0;

  return {
    elemento: String(parsed.elemento || 'Anchored soil slope').trim(),
    patologia: String(parsed.patologia || 'Sin descripción técnica').trim(),
    severidad,
    porcentaje,
    recomendacion: String(parsed.recomendacion || 'Inspección detallada en sitio').trim()
  };
}

async function callAnthropic({ apiKey, mediaType, data, model }) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      temperature: 0.1,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data
              }
            },
            {
              type: 'text',
              text: SYSTEM_PROMPT
            }
          ]
        }
      ]
    })
  });

  const payload = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, payload };
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const apiKey = (body.apiKey || req.headers['x-api-key'] || process.env.ANTHROPIC_API_KEY || '').trim();

    if (!apiKey) {
      return res.status(401).json({
        error: 'Falta la clave de API de Anthropic (ANTHROPIC_API_KEY en el servidor o ingresada en la interfaz).'
      });
    }

    if (!body.image) {
      return res.status(400).json({ error: 'No se recibió ninguna imagen para analizar.' });
    }

    const { mediaType, data } = parseDataUrl(body.image, body.mediaType);
    const candidateModels = [
      body.model || process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
      'claude-3-5-sonnet-latest',
      'claude-3-5-haiku-latest'
    ];

    let lastResult = null;
    for (const model of candidateModels) {
      lastResult = await callAnthropic({ apiKey, mediaType, data, model });
      if (lastResult.ok) break;
      const errType = lastResult.payload?.error?.type || '';
      const errMsg = lastResult.payload?.error?.message || '';
      if (lastResult.status !== 404 && errType !== 'not_found_error' && !/model/i.test(errMsg)) {
        break;
      }
    }

    if (!lastResult || !lastResult.ok) {
      const msg = lastResult?.payload?.error?.message || 'Error al consultar Anthropic Claude Vision API.';
      return res.status(lastResult?.status || 502).json({ error: msg });
    }

    const textBlock = (lastResult.payload.content || []).find(c => c.type === 'text');
    if (!textBlock || !textBlock.text) {
      return res.status(502).json({ error: 'Respuesta vacía del agente de visión.' });
    }

    const result = normalizeAgentJson(textBlock.text);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({
      error: err && err.message ? err.message : 'Error interno procesando la imagen.'
    });
  }
};
