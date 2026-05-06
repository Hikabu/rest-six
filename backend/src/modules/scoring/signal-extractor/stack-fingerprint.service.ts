import { Injectable } from '@nestjs/common';

/**
 * TOOL_MAP defines the mapping between dependency keys and human-readable tool names.
 * Exact matches are used for most keys, with '@aws-sdk' handled via prefix matching.
 */
const TOOL_MAP: Record<string, string> = {
  '@coral-xyz/anchor': 'Anchor',
  'anchor-lang': 'Anchor',
  '@solana/web3.js': 'Solana web3.js',
  bullmq: 'BullMQ',
  bull: 'BullMQ',
  kafkajs: 'Kafka',
  'kafka-node': 'Kafka',
  amqplib: 'RabbitMQ',
  'aws-sdk': 'AWS',
  '@clickhouse/client': 'ClickHouse',
  clickhouse: 'ClickHouse',
  '@graphprotocol/graph-ts': 'The Graph',
  hardhat: 'Hardhat',
  'forge-std': 'Foundry',
  prisma: 'Prisma',
  '@prisma/client': 'Prisma',
  typeorm: 'TypeORM',
  redis: 'Redis',
  ioredis: 'Redis',
  pg: 'PostgreSQL',
  postgres: 'PostgreSQL',
  mongoose: 'MongoDB',
};

@Injectable()
export class StackFingerprintService {
  /**
   * Detects tools from flattened manifest keys across all repositories.
   * deduplicates and sorts alphabetically.
   */
  detectTools(manifestKeys: Record<string, string[]> | undefined | null): string[] {
    const tools = new Set<string>();

    if (!manifestKeys) {
      return [];
    }

    // Flatten all dependency keys from all repositories
    const allKeys = Object.values(manifestKeys).flat();

    for (const key of allKeys) {
      // 1. Prefix match for AWS
      if (key.startsWith('@aws-sdk')) {
        tools.add('AWS');
        continue;
      }

      // 2. Exact match for others
      const toolName = TOOL_MAP[key];
      if (toolName) {
        tools.add(toolName);
      }
    }

    return Array.from(tools).sort((a, b) => a.localeCompare(b));
  }

  /**
   * Extracts the full stack fingerprint.
   * @param manifestKeys Maps repo names or files to lists of dependency keys.
   * @param languages Pre-extracted top languages to be passed through.
   */
  extract(
    manifestKeys: Record<string, string[]> | undefined | null,
    languages: string[],
  ): { languages: string[]; tools: string[] } {
    return {
      languages,
      tools: this.detectTools(manifestKeys),
    };
  }
}
