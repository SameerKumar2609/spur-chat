import { query, testConnection } from './pool';
import dotenv from 'dotenv';

dotenv.config();

async function seed(): Promise<void> {
  await testConnection();

  console.log('🌱 Seeding database...');

  // Insert a sample conversation so the app isn't empty on first load
  const conversations = await query<{ id: string }>(
    `INSERT INTO conversations (metadata)
     VALUES ($1)
     RETURNING id`,
    [JSON.stringify({ source: 'seed' })]
  );

  const convId = conversations[0].id;

  const seedMessages = [
    { sender: 'user', text: 'Hi, what are your store hours?' },
    {
      sender: 'ai',
      text: "Hi there! Our customer support team is available Monday–Friday, 9 AM–6 PM EST. Outside those hours, I'm here 24/7 to help you with any questions. Is there anything I can assist you with right now?",
    },
    { sender: 'user', text: "What's your return policy?" },
    {
      sender: 'ai',
      text: 'We offer a 30-day return policy on all items. Products must be unused and in their original packaging. To start a return, just reply here or email us at support@spurstore.com and we\'ll send you a prepaid return label within 1 business day.',
    },
  ];

  for (const msg of seedMessages) {
    await query(
      `INSERT INTO messages (conversation_id, sender, text)
       VALUES ($1, $2, $3)`,
      [convId, msg.sender, msg.text]
    );
  }

  console.log(`✅ Seeded conversation ${convId} with ${seedMessages.length} messages`);
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
