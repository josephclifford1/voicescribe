
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/chat', async (req, res) => {
  try {
    const { messages, system } = req.body;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.OPENROUTER_API_KEY,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'VoiceScribe AI'
      },
      body: JSON.stringify({
        model: 'openrouter/auto',
        plugins: [{ id: 'web', max_results: 3 }],
        messages: [
          { role: 'system', content: system },
          ...messages
        ]
      })
    });

    const data = await response.json();
    console.log('OpenRouter response status:', data.choices ? 'OK' : 'ERROR');
    if (data.error) console.error('Error:', data.error.message);

    const text = data.choices && data.choices[0] && data.choices[0].message.content || 'No response';
    res.json({ content: [{ text: text }] });

  } catch (err) {
    console.error('API Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(3001, function() {
  console.log('Proxy running on http://localhost:3001');
});
