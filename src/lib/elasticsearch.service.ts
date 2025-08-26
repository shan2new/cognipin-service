import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface ElasticsearchResponse<T = any> {
  took: number;
  timed_out: boolean;
  _shards: {
    total: number;
    successful: number;
    skipped: number;
    failed: number;
  };
  hits: {
    total: {
      value: number;
      relation: string;
    };
    max_score: number;
    hits: Array<{
      _index: string;
      _id: string;
      _score: number;
      _source: T;
    }>;
  };
}

@Injectable()
export class ElasticsearchService implements OnModuleInit {
  private readonly logger = new Logger('ElasticsearchService');
  private esUrl: string;
  private esApiKey: string;
  private initialized = false;

  constructor(private configService: ConfigService) {
    this.esUrl = this.configService.get<string>('ELASTICSEARCH_URL', '');
    this.esApiKey = this.configService.get<string>('ELASTICSEARCH_API_KEY', '');
  }

  async onModuleInit() {
    if (!this.esUrl || !this.esApiKey) {
      this.logger.warn('Elasticsearch configuration missing, service will be disabled');
      return;
    }

    try {
      const response = await fetch(`${this.esUrl}/_cluster/health`, {
        headers: {
          'Authorization': `ApiKey ${this.esApiKey}`,
        },
      });

      if (response.ok) {
        const health = await response.json();
        this.logger.log(`Elasticsearch connected: ${health.status} (${health.cluster_name})`);
        this.initialized = true;
      } else {
        this.logger.error(`Elasticsearch connection failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      this.logger.error('Elasticsearch connection error', error);
    }
  }

  async search<T = any>(index: string, query: object): Promise<ElasticsearchResponse<T>> {
    if (!this.initialized) {
      this.logger.warn('Elasticsearch service not initialized, falling back to empty response');
      return {
        took: 0,
        timed_out: false,
        _shards: { total: 0, successful: 0, skipped: 0, failed: 0 },
        hits: {
          total: { value: 0, relation: 'eq' },
          max_score: 0,
          hits: []
        }
      };
    }

    try {
      const response = await fetch(`${this.esUrl}/${index}/_search`, {
        method: 'POST',
        headers: {
          'Authorization': `ApiKey ${this.esApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(query),
      });

      if (!response.ok) {
        const error = await response.text();
        this.logger.error(`Elasticsearch search failed: ${response.status} ${response.statusText}`, error);
        throw new Error(`Elasticsearch search failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      this.logger.error('Elasticsearch search error', error);
      throw error;
    }
  }

  async indexExists(index: string): Promise<boolean> {
    if (!this.initialized) {
      return false;
    }

    try {
      const response = await fetch(`${this.esUrl}/${index}`, {
        method: 'HEAD',
        headers: {
          'Authorization': `ApiKey ${this.esApiKey}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async createIndex(index: string, settings?: any): Promise<boolean> {
    if (!this.initialized) {
      return false;
    }

    try {
      const response = await fetch(`${this.esUrl}/${index}`, {
        method: 'PUT',
        headers: {
          'Authorization': `ApiKey ${this.esApiKey}`,
          'Content-Type': 'application/json',
        },
        body: settings ? JSON.stringify(settings) : undefined,
      });

      return response.ok;
    } catch (error) {
      this.logger.error(`Failed to create index ${index}`, error);
      return false;
    }
  }

  async indexDocument(index: string, id: string, document: any): Promise<boolean> {
    if (!this.initialized) {
      return false;
    }

    try {
      const response = await fetch(`${this.esUrl}/${index}/_doc/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `ApiKey ${this.esApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(document),
      });

      return response.ok;
    } catch (error) {
      this.logger.error(`Failed to index document ${id} in ${index}`, error);
      return false;
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}
