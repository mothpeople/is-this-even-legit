import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export async function POST(req: Request) {
  try {
    const { text, imageBase64 } = await req.json();
    const cleanText = (text || "").trim();

    const isUrlRegex = /^(https?:\/\/)?([\w\d-]+\.)+[\w\d]{2,}(\/.*)?$/i;
    const isJustUrl = isUrlRegex.test(cleanText) && !cleanText.includes(' ');

    const jobBoardRegex = /(linkedin\.com|indeed\.com|glassdoor\.com|ziprecruiter\.com|monster\.com|workday\.com|greenhouse\.io|lever\.co)/i;
    
    if (isJustUrl && jobBoardRegex.test(cleanText)) {
      return NextResponse.json({
        scam_probability: null,
        confidence_level: "Low",
        summary: "i can't access external job boards directly to read the posting.",
        green_flags: [],
        exhibits: ["cannot scrape job board links."],
        fit_analysis: [
          "please copy and paste the full job description text or upload a screenshot of the listing.",
          "this helps me properly assess the forensic details, the pros and cons, and how this job fits you."
        ]
      });
    }

    let scrapedContent = "";
    let threatIntel = "";

    if (isJustUrl) {
      try {
        const fetchUrl = cleanText.startsWith('http') ? cleanText : `https://${cleanText}`;
        const res = await fetch(fetchUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
        
        if (res.ok) {
          const html = await res.text();
          const $ = cheerio.load(html);
          $('script, style, noscript, iframe, img, svg').remove();
          scrapedContent = $('body').text().replace(/\s+/g, ' ').substring(0, 5000);
        }
      } catch (err) {
        scrapedContent = "[Target website blocked the scraper.]";
      }

      const safeBrowsingKey = process.env.GOOGLE_SAFE_BROWSING_KEY;
      if (safeBrowsingKey) {
        try {
          const sbRes = await fetch(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${safeBrowsingKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              client: { clientId: "itel-scanner", clientVersion: "1.0" },
              threatInfo: {
                threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE"],
                platformTypes: ["ANY_PLATFORM"],
                threatEntryTypes: ["URL"],
                threatEntries: [{ url: cleanText }]
              }
            })
          });
          const sbData = await sbRes.json();
          if (sbData && sbData.matches && sbData.matches.length > 0) {
            threatIntel = "CRITICAL FORENSIC ALERT: THIS URL IS CURRENTLY BLACKLISTED ON GOOGLE SAFE BROWSING AS MALWARE/PHISHING.";
          } else {
            threatIntel = "Google Safe Browsing reports this URL is currently clean.";
          }
        } catch (e) {
          threatIntel = "Safe Browsing check unavailable.";
        }
      }
    }

    const scamKeywords = /(kindly|telegram interview|western union|crypto wallet|guaranteed income|no experience necessary.*\$[0-9]{3,}.*hour)/i;
    const isRegexFlagged = cleanText && scamKeywords.test(cleanText);

    // --- ANTI-SPOOFING ZERO-TRUST DIRECTIVES ---
    const systemInstruction = `
      You are an Elite Forensic Cyber-Fraud Analyst. You operate with a STRICT ZERO-TRUST POSTURE.
      
      Deep Analysis Criteria:
      1. THE IMPERSONATION/SPOOFING VECTOR (CRITICAL): Scammers impersonate real, verifiable companies. Even if the company mentioned (e.g., DeArk, Google, Amazon) is 100% real, if the email itself is unsolicited, vague, or uses false framing, assume it is an IMPERSONATOR. Do NOT lower the scam probability just because the company exists.
      2. Stage 1 Pre-Funnel Scams (CRITICAL): If an outreach is deliberately vague (no specific role, no compensation details) AND comes from a high-risk sector (Web3, Crypto, Data Entry), treat it as a HIGH PROBABILITY SCAM. 
      3. False Framing: Unsolicited emails starting with "Thank you for applying" or "Saw your profile" without specifics are classic social engineering tactics designed to lower the target's guard.
      
      Tone: Factual police blotter, authoritative, calm, and clinical.
    `;

    let prompt = `
      Input Data: ${cleanText || "See attached document/image."}
      Is the input strictly a single URL?: ${isJustUrl}
      Scraped Website Text (if URL): ${scrapedContent || "N/A"}
      Hard Forensic Data: ${threatIntel || "N/A"}
      
      CRITICAL INSTRUCTION 1: Evaluate the communication tactics, NOT just the entity. Vague outreach utilizing false familiarity ("Thanks for applying") in the Web3 sector is a massive red flag for a Stage 1 Spoofing Scam.
      
      CRITICAL INSTRUCTION 2: In the "fit_analysis" section, explicitly warn if this appears to be an impersonation of a real company. Based on my user profile, evaluate if this fits me and what legitimate benefits I could get (or if it's purely a trap).

      Output format:
      You must respond ONLY with a valid JSON object. Do not include markdown formatting like \`\`\`json.
      {
        "scam_probability": [Integer between 0 and 100. STRICT SCORING: 100 = blatant scam/spoof. 75-99 = highly suspicious / stage 1 funnel / impersonation attempt. 0 = 100% verified authentic sender AND safe content.],
        "confidence_level": ["High", "Medium", or "Low"],
        "exhibits": [
          "A short, punchy sentence detailing a specific red flag / con found",
          "Another specific red flag found."
        ],
        "green_flags": ["Positive forensic signs / pros found. (Leave empty if none)."],
        "summary": "A 2-sentence clinical summary of your findings and a recommended action.",
        "fit_analysis": ["Point 1 detailing legitimacy, user fit, and potential benefits", "Point 2 referencing scam/spoofing patterns"]
      }
    `;

    if (isRegexFlagged) {
         prompt += "\n\nNote: Our initial local filter flagged potential scam keywords. Please investigate deeply.";
    }

    let mimeType = "";
    let cleanBase64 = "";
    
    if (imageBase64) {
      if (imageBase64.includes(';base64,')) {
        mimeType = imageBase64.split(';base64,')[0].replace('data:', '');
        cleanBase64 = imageBase64.split(';base64,')[1];
      } else {
        mimeType = "image/png";
        cleanBase64 = imageBase64;
      }
    }

    try {
      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (!geminiApiKey) throw new Error("Gemini API Key missing");

      const geminiBody: any = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
        systemInstruction: { parts: [{ text: systemInstruction }] }
      };

      if (cleanBase64) {
        geminiBody.contents[0].parts.push({
          inlineData: { mimeType: mimeType, data: cleanBase64 }
        });
      }

      const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiBody)
      });

      if (!geminiRes.ok) throw new Error(`Gemini failed with ${geminiRes.status}`);

      const data = await geminiRes.json();
      let jsonText = data.candidates[0].content.parts[0].text;
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      return NextResponse.json(JSON.parse(jsonText));

    } catch (primaryError) {
      console.warn("Google Gemini failed. Falling back to Anthropic Claude...", primaryError);
      
      const claudeApiKey = process.env.CLAUDE_API_KEY;
      if (!claudeApiKey) throw new Error("Both Gemini failed and Claude API key is missing.");

      const claudeContent: any[] = [{ type: "text", text: prompt }];

      if (cleanBase64) {
        if (mimeType.startsWith("image/")) {
          claudeContent.unshift({
            type: "image",
            source: { type: "base64", media_type: mimeType, data: cleanBase64 }
          });
        } else {
          claudeContent[0].text += "\n\n[Note: A PDF document was uploaded but could not be parsed by the offline fallback engine. Rely on text forensics.]";
        }
      }

      const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': claudeApiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6", 
          max_tokens: 1500, 
          system: systemInstruction,
          messages: [{ role: "user", content: claudeContent }]
        })
      });

      if (!claudeRes.ok) {
        const errorText = await claudeRes.text();
        throw new Error(`Claude API Error (${claudeRes.status}): ${errorText}`);
      }

      const claudeData = await claudeRes.json();
      let jsonText = claudeData.content[0].text;
      
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      return NextResponse.json(JSON.parse(jsonText));
    }

  } catch (error: any) {
    console.error("Backend Error:", error);
    return NextResponse.json({ 
      scam_probability: null, 
      confidence_level: "Error",
      summary: "System Exception Triggered.", 
      green_flags: [], 
      exhibits: ["Failed to complete analysis on both Gemini and Claude engines."], 
      fit_analysis: [error.message || "An unknown error occurred."]
    });
  }
}