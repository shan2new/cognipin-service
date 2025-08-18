# Environment Variables Configuration

## AI Provider Configuration

The company search service now uses a hybrid approach combining Tavily web search with OpenRouter fallback for optimal results. You need to set the following environment variables:

### Required Variables

```bash
# OpenRouter API Key (for Moonshot AI Kimi K2 model and fallback search)
OPENROUTER_API_KEY=your_openrouter_api_key_here

# Tavily API Key (for specialized business web search)
TAVILY_API_KEY=your_tavily_api_key_here
```

### Previous Variables (No Longer Used)

```bash
# OPENAI_API_KEY=... # This is no longer required
```

## Migration Notes

- **Speed-Optimized Fallback Strategy**: 
  1. **Primary**: Llama 3.1 8B free - Fast, handles most straightforward company queries (<2s)
  2. **Secondary**: Mistral Small free - Still fast, more capable for harder cases  
  3. **Reasoning**: DeepSeek-R1 free - Only for disambiguation that needs reasoning
  4. **Web Search**: Tavily - Only when model confidence is low or sources are missing ($0.008/query after 1k free)
  
- **Enhanced Search Quality**: Tavily's specialized business data sources provide higher quality company information
- **Reliability**: OpenRouter fallback ensures consistent results even if Tavily is unavailable
- **Extended Context**: Kimi K2's 128,000 token context window processes extensive company information
- **Agentic Capabilities**: Enhanced autonomous problem-solving and tool integration
- **Optimal Performance**: Best of both worlds - specialized search + AI reasoning

## Search Strategy

1. **Llama 3.1 8B**: Fast primary model for straightforward company queries (80%+ success rate)
2. **Confidence Check**: Evaluates result quality, confidence scores, and source availability  
3. **Mistral Small**: Secondary fast model for cases Llama couldn't handle well
4. **Reasoning Check**: Determines if query needs disambiguation or complex reasoning
5. **DeepSeek-R1**: Only for disambiguation, complex queries, or ambiguous cases
6. **Tavily Web Search**: Last resort when confidence is low or authoritative sources needed
7. **Validation**: All results validated for domain correctness and data contamination

## Cost & Speed Optimization

- **Llama 3.1 8B Free**: Primary fast model resolves 80%+ queries in <2s at zero cost
- **Mistral Small Free**: Secondary fast model for harder cases, still <3s response time
- **DeepSeek-R1 Free**: Reasoning model only for disambiguation cases (~10% of queries)
- **Tavily Web Search**: $0.008/query after 1k free credits, used for <5% of queries when AI confidence is low
- **Result**: Average query cost ~$0.0004, average response time <2s

## API Key Acquisition

1. **OpenRouter**: Sign up at https://openrouter.ai/ and get your API key from the dashboard
2. **Tavily**: Sign up at https://tavily.com/ and get your API key from the developer console

Both services offer generous free tiers to get started.
