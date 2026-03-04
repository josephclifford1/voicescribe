const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

console.log('KEY:', process.env.GROQ_API_KEY ? 'Found - ' + process.env.GROQ_API_KEY.slice(0, 15) : 'MISSING');

app.post('/api/chat', async (req, res) => {
  try {
    const { messages, system } = req.body;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + process.env.GROQ_API_KEY,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: system },
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
