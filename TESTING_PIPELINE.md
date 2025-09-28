# 🧪 Aurora Database Integration - Complete Testing Pipeline

## Prerequisites
- Python 3.8+ installed
- All dependencies installed (`pip install -r requirements.txt`)
- OpenAI API key in `.env` file
- Tavus API key in `.env` file (optional for database testing)

---

## STEP 1: Environment Setup

### 1.1 Check Your .env File
```bash
# Make sure your .env file contains:
OPENAI_API_KEY=your_openai_key_here
TAVUS_API_KEY=your_tavus_key_here  # Optional for database testing
```

### 1.2 Verify Dependencies
```bash
pip install -r requirements.txt
```

### 1.3 Check Current Directory
```bash
# You should be in the project folder with final_aurora.py
ls -la
# Should show: final_aurora.py, test_database.py, database_viewer.html
```

---

## STEP 2: Start the Aurora System

### 2.1 Launch Aurora
```bash
python final_aurora.py
```

### 2.2 Verify Startup Messages
Look for these messages in order:
```
Aurora Final Processing System starting...
Connected to LanceDB at ./aurora_db
✅ Database initialized successfully
Created new users table
Created new conversations table
Created new insights table
✅ OpenAI API key configured
✅ Tavus API key configured
🚀 System ready for real-time processing with database storage!
```

### 2.3 Test Basic Server
Open browser to: `http://localhost:8000`
Should see: `{"message": "Aurora Final Processing System", "status": "active"}`

---

## STEP 3: Database Initialization Test

### 3.1 Check Database Status
```bash
curl http://localhost:8000/api/database/status
```

**Expected Response:**
```json
{
  "database_connected": true,
  "tables_initialized": {
    "users": true,
    "conversations": true,
    "insights": true
  },
  "database_path": "./aurora_db",
  "record_counts": {
    "users": 0,
    "conversations": 0,
    "insights": 0,
    "total_records": 0
  }
}
```

### 3.2 Check Database Folder
```bash
ls -la aurora_db/
```
Should show:
- `users.lance`
- `conversations.lance`
- `insights.lance`

---

## STEP 4: Automated Database Testing

### 4.1 Run Complete Test Suite
```bash
python test_database.py
```

### 4.2 Expected Test Output
```
🚀 Aurora Database Test Suite
==================================================
Testing against: http://localhost:8000
Test started at: 2024-XX-XX XX:XX:XX

✅ Aurora server is running

==================== Database Status ====================
🔍 Testing database status...
✅ Database connected: True
✅ Tables initialized: {'users': True, 'conversations': True, 'insights': True}
📊 Current records:
   Users: 0
   Conversations: 0
   Insights: 0
   Total: 0

==================== Speech Processing ====================
🎤 Testing speech processing with database storage...
Processing speech 1/3...
  ✅ Topic: career
  ✅ Emotion: excited
  ✅ Importance: 8/10
  ✅ Database stored: True
Processing speech 2/3...
  ✅ Topic: career
  ✅ Emotion: nervous
  ✅ Importance: 9/10
  ✅ Database stored: True
Processing speech 3/3...
  ✅ Topic: personal
  ✅ Emotion: grateful
  ✅ Importance: 7/10
  ✅ Database stored: True
📊 Processed 3/3 speeches successfully

==================== User Profile ====================
👤 Testing user profile retrieval...
✅ User ID: test_user_demo
✅ Total conversations: 1
✅ Relationship level: 45.2
✅ Trust level: 52.1
✅ Insights count: 6

==================== Insights Retrieval ====================
🧠 Testing insights retrieval...
✅ Total insights: 6
✅ Insight categories: ['emotional', 'behavioral']
   emotional: 4 insights
   Latest: This person demonstrates high emotional intelligence...
   behavioral: 2 insights
   Latest: Shows pattern of seeking validation and support...

==================== Semantic Search ====================
🔍 Testing semantic search...
Searching for: 'career anxiety'
  ✅ Found 3 results
    - This person shows significant concern about professional...
    - Career transition appears to be creating emotional stress...
Searching for: 'new job excitement'
  ✅ Found 2 results
    - Demonstrates enthusiasm and anticipation for new opportunity...
    - Shows balanced emotional response to career change...
Searching for: 'emotional support'
  ✅ Found 4 results
    - Values interpersonal connection during vulnerable moments...
    - Seeks reassurance and understanding from others...

==================== Database Operations ====================
⚙️ Testing database operations...
✅ Overall status: All tests passed
  ✅ User Creation
  ✅ Insight Storage
  ✅ Insight Retrieval
  ✅ Semantic Search

📈 Recent database activity...
👥 Recent users (1):
   test_user_demo - 1 conversations
💡 Recent insights (6):
   This person demonstrates high emotional intelligence...
   Shows pattern of seeking validation and support...
   Career transition appears to be creating emotional stress...

🧹 Cleaning up test data...
✅ Cleared 7 test records

==================================================
🎯 Test Results: 6/6 tests passed
🎉 All tests passed! Your database is working perfectly!
Test completed at: 2024-XX-XX XX:XX:XX
```

---

## STEP 5: Web Interface Testing

### 5.1 Open Database Viewer
Open `database_viewer.html` in your browser

### 5.2 Check Each Tab
1. **Database Status Tab**: Should show green checkmarks and record counts
2. **Users Tab**: Should show user profiles (may be empty initially)
3. **Conversations Tab**: Should show recent conversations
4. **Insights Tab**: Should show generated insights
5. **Analytics Tab**: Should show database statistics
6. **Search Tab**: Type "career" and click search

### 5.3 Expected Web Interface
- Green status indicators
- Real-time record counts
- Searchable insights
- Auto-refresh every 30 seconds

---

## STEP 6: Manual Speech Processing Test

### 6.1 Test Single Speech Processing
```bash
curl -X POST http://localhost:8000/api/process-speech \
  -H "Content-Type: application/json" \
  -d '{
    "text": "I just got promoted at work! This is amazing, I have been working towards this for years.",
    "user_id": "manual_test_user",
    "conversation_id": "manual_test_conv"
  }'
```

### 6.2 Expected Response
```json
{
  "speech_record": {
    "id": "speech_1",
    "text": "I just got promoted at work! This is amazing...",
    "analysis": {
      "topic": "career",
      "emotion": "excited",
      "sentiment": "positive",
      "importance": 9,
      "vulnerability": 4,
      "energy_level": 9,
      "insights": ["Shows strong career achievement satisfaction", "Demonstrates long-term goal persistence"]
    },
    "timestamp": "2024-XX-XXTXX:XX:XX",
    "user_id": "manual_test_user"
  },
  "updated_metrics": {
    "relationship_level": 28.6,
    "trust_level": 38.2,
    "emotional_sync": 48.6
  },
  "user_profile": {
    "user_id": "manual_test_user",
    "total_conversations": 0,
    "avg_relationship_level": 25.0
  },
  "processing_status": "complete",
  "database_stored": true
}
```

### 6.3 Verify Database Storage
```bash
curl http://localhost:8000/api/users/manual_test_user
```

Should return user profile with the new data.

---

## STEP 7: Conversation Flow Testing

### 7.1 Process Multiple Related Speeches
```bash
# Speech 1
curl -X POST http://localhost:8000/api/process-speech \
  -H "Content-Type: application/json" \
  -d '{
    "text": "I am nervous about starting my new job next week. What if I am not good enough?",
    "user_id": "flow_test_user",
    "conversation_id": "job_anxiety_conv"
  }'

# Wait 2 seconds
sleep 2

# Speech 2
curl -X POST http://localhost:8000/api/process-speech \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Actually, I think I am overthinking this. I have the skills they need, that is why they hired me.",
    "user_id": "flow_test_user",
    "conversation_id": "job_anxiety_conv"
  }'

# Wait 2 seconds
sleep 2

# Speech 3
curl -X POST http://localhost:8000/api/process-speech \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Thank you for helping me work through this. I feel much more confident now.",
    "user_id": "flow_test_user",
    "conversation_id": "job_anxiety_conv"
  }'
```

### 7.2 Check Conversation Record
```bash
curl http://localhost:8000/api/conversation/job_anxiety_conv
```

Should show complete conversation with all 3 speeches.

### 7.3 Check Generated Insights
```bash
curl http://localhost:8000/api/users/flow_test_user/insights
```

Should show insights about anxiety patterns, self-reflection, and emotional processing.

---

## STEP 8: Analytics and Search Testing

### 8.1 Get User Analytics
```bash
curl http://localhost:8000/api/analytics/user/flow_test_user
```

### 8.2 Test Semantic Search
```bash
curl -X POST http://localhost:8000/api/insights/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "job anxiety and confidence",
    "limit": 5
  }'
```

### 8.3 Get Recent Activity
```bash
curl http://localhost:8000/api/database/recent-activity
```

---

## STEP 9: Stress Testing

### 9.1 Process 10 Rapid Speeches
```bash
for i in {1..10}; do
  curl -X POST http://localhost:8000/api/process-speech \
    -H "Content-Type: application/json" \
    -d "{
      \"text\": \"This is stress test message number $i. I am testing the database performance.\",
      \"user_id\": \"stress_test_user\",
      \"conversation_id\": \"stress_test_conv\"
    }"
  echo "Processed speech $i"
  sleep 1
done
```

### 9.2 Verify Database Performance
```bash
curl http://localhost:8000/api/database/status
```

Should show 10+ new records and still respond quickly.

---

## STEP 10: Backup and Recovery Testing

### 10.1 Create Database Backup
```bash
curl -X POST http://localhost:8000/api/database/backup
```

### 10.2 Verify Backup File
```bash
ls -la aurora_backup_*.json
```

Should show a JSON backup file with timestamp.

---

## STEP 11: Final Verification

### 11.1 Check Final Database Status
```bash
curl http://localhost:8000/api/database/status
```

### 11.2 Review Web Interface
- Refresh `database_viewer.html`
- Should show all test data
- Search should return relevant results
- Analytics should show increased activity

### 11.3 Check Console Logs
Your Aurora console should show:
```
Processing speech for user manual_test_user: I just got promoted...
Analysis complete:
  Topic: career
  Emotion: excited
  Importance: 9/10
  Vulnerability: 4/10
  Relationship Level: 28.6/100
Stored insight: real_time_analysis - Shows strong career achievement...
Created new user: manual_test_user
```

---

## 🎯 Success Criteria

✅ **Database initialization**: All 3 tables created
✅ **Speech processing**: Text analyzed and stored with insights
✅ **User profiles**: Created and updated automatically
✅ **Conversation tracking**: Multi-turn conversations recorded
✅ **Insight generation**: High-importance speeches generate insights
✅ **Semantic search**: Can find relevant insights by meaning
✅ **Analytics**: User statistics calculated correctly
✅ **Web interface**: Real-time monitoring works
✅ **Performance**: System handles multiple rapid requests
✅ **Backup**: Database can be backed up to JSON

---

## 🚨 Troubleshooting

### If Tests Fail:

1. **Database connection issues**: Check if `./aurora_db/` folder exists
2. **OpenAI API errors**: Verify API key in `.env` file
3. **Server not responding**: Restart `python final_aurora.py`
4. **Import errors**: Run `pip install -r requirements.txt`
5. **Port conflicts**: Make sure port 8000 is free

### Common Error Messages:

- `Database not initialized`: Restart Aurora system
- `OpenAI analysis error`: Check API key and quota
- `Error getting counts`: Database corruption - delete `aurora_db/` and restart
- `Embedding generation error`: OpenAI API issue - check network/quota

---

## 📊 Expected Final State

After running all tests, you should have:
- **3+ users** in database
- **3+ conversations** recorded
- **10+ insights** generated
- **Semantic search** working
- **Real-time web monitoring** functional
- **Backup capability** tested

**Your Aurora system is now fully integrated with persistent database storage!** 🎉