import { Injectable } from '@nestjs/common';
import { LogoDownloader } from './interfaces';

@Injectable()
export class ClearbitLogoDownloader implements LogoDownloader {
  async downloadLogo(domain: string): Promise<string | null> {
    try {
      const url = `https://logo.clearbit.com/${domain}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; CompanyLogoFetcher/1.0)',
        },
      });

      if (!response.ok) {
        console.warn(`Failed to download logo for domain ${domain}: ${response.status}`);
        return null;
      }

      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      const mimeType = response.headers.get('content-type') || 'image/png';
      
      return `data:${mimeType};base64,${base64}`;
    } catch (error) {
      console.error(`Error downloading logo for domain ${domain}:`, error);
      return null;
    }
  }
}
