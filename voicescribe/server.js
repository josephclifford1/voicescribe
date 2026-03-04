const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

console.log('GROQ KEY:', process.env.GROQ_API_KEY ? 'Found' : 'MISSING');

// Search using DuckDuckGo Instant Answer API - no key needed
async function searchWeb(query) {
  try {
    const url = 'https://api.duckduckgo.com/?q=' + encodeURIComponent(query) + '&format=json&no_html=1&skip_disambig=1';
    const response = await fetch(url, {
      headers: { 'User-Agent': 'VoiceScribeAI/1.0' }
    });
    const data = await response.json();

    let results = [];

    // Abstract (main answer)
    if (data.AbstractText) {
      results.push('Summary: ' + data.AbstractText);
    }

    // Answer (direct answer like calculations, facts)
    if (data.Answer) {
      results.push('Answer: ' + data.Answer);
    }

    // Infobox data
    if (data.Infobox && data.Infobox.content) {
      const facts = data.Infobox.content.slice(0, 3).map(f => f.label + ': ' + f.value).join(', ');
      if (facts) results.push('Facts: ' + facts);
    }

    // Related topics
    if (data.RelatedTopics && data.RelatedTopics.length > 0) {
      const topics = data.RelatedTopics
        .filter(t => t.Text)
        .slice(0, 2)
        .map(t => t.Text);
      if (topics.length) results.push('Related: ' + topics.join(' | '));
    }

    return results.join('\n\n');
  } catch (err) {
    console.error('Search error:', err.message);
    return '';
  }
}

// Detect if a query needs web search
function needsWebSearch(message) {
  const triggers = [
    'current', 'latest', 'today', 'now', 'recent', 'news',
    'who is', 'what is the', 'price of', 'score', 'weather',
    'richest', 'president', 'ceo', 'winner', 'champion',
    '2024', '2025', '2026', 'happened', 'update', 'new'
  ];
  const lower = message.toLowerCase();
  return triggers.some(t => lower.includes(t));
}

app.post('/api/chat', async (req, res) => {
  try {
    const { messages, system } = req.body;
    const lastMessage = messages[messages.length - 1].content;

    // Strip transcript block to get just the user question
    const userQuestion = lastMessage.split('\n\n[CURRENT TRANSCRIPT]')[0].trim();

    let webContext = '';
    if (needsWebSearch(userQuestion)) {
      console.log('Searching web for:', userQuestion);
      webContext = await searchWeb(userQuestion);
      console.log('Web results:', webContext ? 'Found - ' + webContext.slice(0, 200) : 'None');
    }

    // Build enhanced system prompt with web results
    const enhancedSystem = system + (webContext
      ? '\n\n[LIVE WEB SEARCH RESULTS]:\n' + webContext + '\n\nUse the above search results to give accurate, up-to-date answers.'
      : '');

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.GROQ_API_KEY,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: enhancedSystem },
          ...messages
        ],
        max_tokens: 1000,
      })
    });

    const data = await response.json();
    console.log('Groq status:', data.choices ? 'OK' : JSON.stringify(data.error));
    const text = data.choices && data.choices[0] && data.choices[0].message.content || 'No response';
    res.json({ content: [{ text: text }] });

  } catch (err) {
    console.error('API Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(3001, function () {
  console.log('Proxy running on http://localhost:3001');
});
