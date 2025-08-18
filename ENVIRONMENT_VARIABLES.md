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

- **Hybrid Fallback Strategy**: 
  1. **Primary**: Tavily for specialized business web search (Crunchbase, LinkedIn, SEC filings, etc.)
  2. **Fallback**: OpenRouter with Moonshot AI Kimi K2 online search if Tavily returns no meaningful results
  
- **Enhanced Search Quality**: Tavily's specialized business data sources provide higher quality company information
- **Reliability**: OpenRouter fallback ensures consistent results even if Tavily is unavailable
- **Extended Context**: Kimi K2's 128,000 token context window processes extensive company information
- **Agentic Capabilities**: Enhanced autonomous problem-solving and tool integration
- **Optimal Performance**: Best of both worlds - specialized search + AI reasoning

## Search Strategy

1. **Tavily First**: Searches business-focused sources (Crunchbase, LinkedIn, Bloomberg, Forbes, etc.)
2. **Quality Check**: Evaluates if Tavily results contain meaningful company information
3. **OpenRouter Processing**: Uses Kimi K2 to analyze Tavily results and structure company data
4. **Fallback Mode**: If Tavily fails, uses OpenRouter's integrated online search
5. **Final Fallback**: If all online methods fail, uses OpenRouter without web search

## Cost Optimization

- **Kimi K2 Free Tier**: All data processing uses `moonshotai/kimi-k2:free` model for zero charges
- **Tavily Free Tier**: Uses `@tavily/core` package with free tier for web search
- **Smart Usage**: Only searches when needed, processes locally with free AI model

## API Key Acquisition

1. **OpenRouter**: Sign up at https://openrouter.ai/ and get your API key from the dashboard
2. **Tavily**: Sign up at https://tavily.com/ and get your API key from the developer console

Both services offer generous free tiers to get started.
