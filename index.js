const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

// ============================================================
// CONFIGURATION — Update these values before running
// ============================================================
const FLOWISE_URL = 'http://localhost:3001/api/v1/prediction/YOUR_CHATFLOW_ID'; // Replace with your Flowise chatflow ID
const WAHA_URL = 'http://localhost:3000/api/sendText';
const WAHA_SESSION = 'default';
const BOT_NUMBER = '917506091750@c.us'; // Bot's own number to avoid self-replies
const WAHA_API_KEY = 'a3fa099cc01642c3b4c410e75044db5a';

// ============================================================
// APPOINTMENT BOOKING DETECTION
// ============================================================
const APPOINTMENT_KEYWORDS = ['meet', 'visit', 'appointment', 'milna', 'milne', 'mulakat', 'meeting'];

function wantsAppointment(text) {
  const lower = text.toLowerCase();
  return APPOINTMENT_KEYWORDS.some(keyword => lower.includes(keyword));
}

const BOOKING_MESSAGE = `📅 Available slots this week:

🗓 Tuesday - 10:00am to 11:00am ✅
🗓 Wednesday - 3:00pm to 4:00pm ✅
🗓 Thursday - 10:00am to 11:00am ✅

Please share:
1️⃣ Your preferred slot
2️⃣ Your name
3️⃣ Purpose of visit

We will confirm your appointment shortly! 😊`;

// ============================================================
// WEBHOOK HANDLER — Receives messages from WAHA
// ============================================================
app.post('/webhook', async (req, res) => {
  try {
    const message = req.body;

    // Only handle incoming message events
    if (message.event !== 'message') return res.sendStatus(200);

    const from = message.payload.from;
    const text = message.payload.body;

    // Skip messages sent by the bot itself
    if (message.payload.fromMe) return res.sendStatus(200);

    // Skip non-text messages (images, stickers, etc.)
    if (!text || text.trim() === '') return res.sendStatus(200);

    console.log(`\n📩 Message from ${from}: ${text}`);

    // Check if user wants to book an appointment
    if (wantsAppointment(text)) {
      console.log(`📅 Appointment intent detected — sending slots`);

      // First, get the AI's contextual reply
      const aiResponse = await axios.post(FLOWISE_URL, {
        question: text,
      });
      const aiReply = aiResponse.data.text;

      // Send AI reply first
      await axios.post(WAHA_URL, {
        chatId: from,
        text: aiReply,
        session: WAHA_SESSION,
      }, { headers: { 'X-Api-Key': WAHA_API_KEY } });

      // Then send appointment slots
      await axios.post(WAHA_URL, {
        chatId: from,
        text: BOOKING_MESSAGE,
        session: WAHA_SESSION,
      }, { headers: { 'X-Api-Key': WAHA_API_KEY } });

      console.log(`✅ Sent AI reply + appointment slots to ${from}`);
      return res.sendStatus(200);
    }

    // Normal flow — send to Flowise AI and reply
    console.log(`🤖 Sending to Flowise AI...`);
    const aiResponse = await axios.post(FLOWISE_URL, {
      question: text,
    });

    const reply = aiResponse.data.text;
    console.log(`💬 AI reply: ${reply.substring(0, 100)}...`);

    // Send reply back via WAHA
    await axios.post(WAHA_URL, {
      chatId: from,
      text: reply,
      session: WAHA_SESSION,
    }, { headers: { 'X-Api-Key': WAHA_API_KEY } });

    console.log(`✅ Reply sent to ${from}`);
    res.sendStatus(200);
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('   Response data:', JSON.stringify(error.response.data).substring(0, 200));
    }
    res.sendStatus(500);
  }
});

// ============================================================
// HEALTH CHECK ENDPOINT
// ============================================================
app.get('/health', (req, res) => {
  res.json({
    status: 'running',
    waha: WAHA_URL,
    flowise: FLOWISE_URL,
    timestamp: new Date().toISOString(),
  });
});

// ============================================================
// START SERVER
// ============================================================
const PORT = 3002;
app.listen(PORT, () => {
  console.log(`\n🚀 WhatsApp Bot Webhook running on port ${PORT}`);
  console.log(`📡 Listening for messages at http://localhost:${PORT}/webhook`);
  console.log(`❤️  Health check at http://localhost:${PORT}/health`);
  console.log(`\n⚙️  Config:`);
  console.log(`   WAHA:    ${WAHA_URL}`);
  console.log(`   Flowise: ${FLOWISE_URL}`);
  console.log(`\n⏳ Waiting for incoming WhatsApp messages...\n`);
});
