const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Store push tokens (in memory - for demo)
let pushTokens = [];

// Register device token
app.post('/api/register', (req, res) => {
  const { token, deviceInfo } = req.body;
  
  if (!token) {
    return res.status(400).json({ error: 'Token is required' });
  }
  
  if (!pushTokens.includes(token)) {
    pushTokens.push(token);
  }
  
  console.log(`Device registered: ${token}`);
  res.json({ 
    success: true, 
    message: 'Device registered successfully',
    totalDevices: pushTokens.length 
  });
});

// Send push notification to specific device
app.post('/api/send-notification', async (req, res) => {
  const { token, title, body, data } = req.body;
  
  if (!token || !title || !body) {
    return res.status(400).json({ 
      error: 'Missing required fields: token, title, body' 
    });
  }
  
  const message = {
    to: token,
    sound: 'default',
    title: title,
    body: body,
    data: data || {},
  };
  
  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('Push notification sent successfully');
      res.json({ success: true, result });
    } else {
      console.error('Expo API error:', result);
      res.status(response.status).json({ error: result });
    }
  } catch (error) {
    console.error('Error sending push:', error);
    res.status(500).json({ error: error.message });
  }
});

// Send broadcast to all registered devices
app.post('/api/broadcast', async (req, res) => {
  const { title, body, data } = req.body;
  
  if (!title || !body) {
    return res.status(400).json({ error: 'Title and body are required' });
  }
  
  if (pushTokens.length === 0) {
    return res.status(404).json({ error: 'No registered devices' });
  }
  
  const messages = pushTokens.map(token => ({
    to: token,
    sound: 'default',
    title: title,
    body: body,
    data: data || {},
  }));
  
  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });
    
    const result = await response.json();
    console.log(`Broadcast sent to ${pushTokens.length} devices`);
    res.json({ success: true, result, devicesCount: pushTokens.length });
  } catch (error) {
    console.error('Error broadcasting:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all registered tokens
app.get('/api/tokens', (req, res) => {
  res.json({ tokens: pushTokens, count: pushTokens.length });
});

app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`\n📱 Endpoints:`);
  console.log(`   POST /api/register - Register device token`);
  console.log(`   POST /api/send-notification - Send to specific device`);
  console.log(`   POST /api/broadcast - Send to all devices`);
  console.log(`   GET /api/tokens - List all tokens`);
});