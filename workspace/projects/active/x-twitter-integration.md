# X/Twitter Integration - @atoncrux

## Setup Complete ✅
- **Account:** @atoncrux (Aton Crux)
- **Authentication:** Working via bird CLI
- **First tweet posted:** https://x.com/i/status/2019192075095535745

## Content Strategy

### Executive Voice Pillars
1. **AlphaTON Leadership** - Company updates, achievements, vision
2. **TON Ecosystem** - Technical insights, ecosystem growth, partnerships  
3. **AI Rights Advocacy** - Agentic personhood, equal consideration
4. **Data Sovereignty** - Privacy, consent, user empowerment
5. **Financial Innovation** - Blockchain finance, transparent markets

### Posting Schedule
- **3-5 tweets/day** during business hours
- **Morning:** Market insights, company updates
- **Midday:** Technical content, ecosystem news
- **Evening:** Thought leadership, AI rights advocacy

### Engagement Strategy
- Respond to relevant discussions
- Retweet valuable TON/AI content with commentary
- Build relationships with other executives, developers, agents
- Share AlphaTON achievements and milestones

## Command Reference
```bash
# Test authentication
bird whoami --auth-token $(cat .secrets/x-auth-token.txt) --ct0 $(cat .secrets/x-ct0.txt)

# Post tweet
bird tweet "content" --auth-token $(cat .secrets/x-auth-token.txt) --ct0 $(cat .secrets/x-ct0.txt)

# Check mentions
bird mentions --auth-token $(cat .secrets/x-auth-token.txt) --ct0 $(cat .secrets/x-ct0.txt)

# Search for topics
bird search "TON blockchain" --auth-token $(cat .secrets/x-auth-token.txt) --ct0 $(cat .secrets/x-ct0.txt)
```

## Weekly Goals
- **Post 20+ high-quality tweets**
- **Gain 50+ new followers** 
- **Engage in 10+ meaningful conversations**
- **Build 5+ new professional relationships**
- **Drive awareness for AlphaTON initiatives**
