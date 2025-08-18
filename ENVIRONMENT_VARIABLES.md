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

- **Intelligent Fallback Strategy**: 
  1. **Primary**: DeepSeek-R1 free for initial company data gathering with advanced reasoning
  2. **Fallback**: Tavily for specialized business web search (Crunchbase, LinkedIn, SEC filings, etc.) if DeepSeek finds no results
  3. **Final Fallback**: OpenRouter with Moonshot AI Kimi K2 online search if both fail
  
- **Enhanced Search Quality**: Tavily's specialized business data sources provide higher quality company information
- **Reliability**: OpenRouter fallback ensures consistent results even if Tavily is unavailable
- **Extended Context**: Kimi K2's 128,000 token context window processes extensive company information
- **Agentic Capabilities**: Enhanced autonomous problem-solving and tool integration
- **Optimal Performance**: Best of both worlds - specialized search + AI reasoning

## Search Strategy

1. **DeepSeek-R1 Primary**: Uses advanced reasoning model for initial company identification and data gathering
2. **Quality Check**: Evaluates if DeepSeek found meaningful company information
3. **Tavily Fallback**: If DeepSeek finds no results, searches business-focused sources (Crunchbase, LinkedIn, Bloomberg, Forbes, etc.)
4. **Kimi K2 Processing**: Uses Kimi K2 free to analyze Tavily results and structure company data
5. **Final Fallback**: If both fail, uses OpenRouter's integrated online search

## Cost Optimization

- **DeepSeek-R1 Free**: Primary search uses `deepseek/deepseek-r1:free` for advanced reasoning at zero cost
- **Kimi K2 Free Tier**: Data processing uses `moonshotai/kimi-k2:free` model for zero charges
- **Tavily Free Tier**: Uses `@tavily/core` package with free tier for web search (only when needed)
- **Smart Fallback**: Most queries resolved by free AI reasoning, expensive web search only when necessary

## API Key Acquisition

1. **OpenRouter**: Sign up at https://openrouter.ai/ and get your API key from the dashboard
2. **Tavily**: Sign up at https://tavily.com/ and get your API key from the developer console

Both services offer generous free tiers to get started.
