import { Injectable } from '@nestjs/common';

interface ResponseSample {
  at: number;
  durationMs: number;
}

export type ResponseMetricCategory = 'business' | 'system' | 'health';
export interface ResponseTimeSeriesPoint {
  at: number;
  averageMs: number | null;
  sampleSize: number;
}

const DEFAULT_SAMPLE_LIMIT_PER_CATEGORY = 1200;
const DEFAULT_RETENTION_WINDOW_MS = 30 * 60 * 1000;
const DEFAULT_SERIES_BUCKET_COUNT = 12;
const MIN_SERIES_BUCKET_COUNT = 4;
const MAX_SERIES_BUCKET_COUNT = 24;
const CATEGORIES: ResponseMetricCategory[] = ['business', 'system', 'health'];

@Injectable()
export class ResponseTimeMetricsService {
  private readonly samplesByCategory: Record<ResponseMetricCategory, ResponseSample[]> = {
    business: [],
    system: [],
    health: [],
  };
  private readonly maxSamplesPerCategory = DEFAULT_SAMPLE_LIMIT_PER_CATEGORY;

  record(durationMs: number, category: ResponseMetricCategory = 'business'): void {
    if (!Number.isFinite(durationMs) || durationMs < 0) {
      return;
    }

    const bucket = this.samplesByCategory[category];
    const lastAt = bucket.length > 0 ? bucket[bucket.length - 1].at : undefined;
    bucket.push({
      at: this.toMonotonicTimestamp(Date.now(), lastAt),
      durationMs,
    });

    this.compactCategory(category);
  }

  getAverageForWindow(
    windowMs: number,
    category: ResponseMetricCategory = 'business',
  ): { averageMs: number | null; sampleSize: number; windowMs: number } {
    const normalizedWindowMs = this.normalizeWindowMs(windowMs);
    const cutoff = Date.now() - normalizedWindowMs;

    this.compactCategory(category, cutoff);

    const relevant = this.samplesByCategory[category].filter((sample) => sample.at >= cutoff);
    if (relevant.length === 0) {
      return {
        averageMs: null,
        sampleSize: 0,
        windowMs: normalizedWindowMs,
      };
    }

    const total = relevant.reduce((acc, sample) => acc + sample.durationMs, 0);
    return {
      averageMs: Number((total / relevant.length).toFixed(2)),
      sampleSize: relevant.length,
      windowMs: normalizedWindowMs,
    };
  }

  getCategorizedAverages(windowMs: number): Record<ResponseMetricCategory, { averageMs: number | null; sampleSize: number }> {
    const result: Record<ResponseMetricCategory, { averageMs: number | null; sampleSize: number }> = {
      business: { averageMs: null, sampleSize: 0 },
      system: { averageMs: null, sampleSize: 0 },
      health: { averageMs: null, sampleSize: 0 },
    };

    for (const category of CATEGORIES) {
      const snapshot = this.getAverageForWindow(windowMs, category);
      result[category] = {
        averageMs: snapshot.averageMs,
        sampleSize: snapshot.sampleSize,
      };
    }

    return result;
  }

  getSeriesForWindow(
    windowMs: number,
    category: ResponseMetricCategory = 'business',
    bucketCount = DEFAULT_SERIES_BUCKET_COUNT,
  ): ResponseTimeSeriesPoint[] {
    const normalizedWindowMs = this.normalizeWindowMs(windowMs);
    const normalizedBucketCount = this.normalizeBucketCount(bucketCount);
    const now = Date.now();
    const bucketSizeMs = Math.max(1_000, Math.ceil(normalizedWindowMs / normalizedBucketCount));
    const bucketStart = now - bucketSizeMs * normalizedBucketCount;

    this.compactCategory(category, bucketStart);

    const buckets = Array.from({ length: normalizedBucketCount }, (_, index) => ({
      at: bucketStart + bucketSizeMs * (index + 1),
      totalMs: 0,
      sampleSize: 0,
    }));

    for (const sample of this.samplesByCategory[category]) {
      if (sample.at < bucketStart) {
        continue;
      }

      const rawIndex = Math.floor((sample.at - bucketStart) / bucketSizeMs);
      const safeIndex = Math.max(0, Math.min(normalizedBucketCount - 1, rawIndex));
      buckets[safeIndex].totalMs += sample.durationMs;
      buckets[safeIndex].sampleSize += 1;
    }

    return buckets.map((bucket) => ({
      at: bucket.at,
      averageMs:
        bucket.sampleSize > 0 ? Number((bucket.totalMs / bucket.sampleSize).toFixed(2)) : null,
      sampleSize: bucket.sampleSize,
    }));
  }

  private compactCategory(category: ResponseMetricCategory, cutoff?: number): void {
    const bucket = this.samplesByCategory[category];
    const minTimestamp = cutoff || Date.now() - DEFAULT_RETENTION_WINDOW_MS;

    while (bucket.length > 0 && bucket[0].at < minTimestamp) {
      bucket.shift();
    }

    while (bucket.length > this.maxSamplesPerCategory) {
      bucket.shift();
    }
  }

  private normalizeWindowMs(windowMs: number): number {
    if (!Number.isFinite(windowMs) || windowMs <= 0) {
      return 5 * 60 * 1000;
    }

    return Math.max(10_000, Math.min(30 * 60 * 1000, Math.floor(windowMs)));
  }

  private normalizeBucketCount(bucketCount: number): number {
    if (!Number.isFinite(bucketCount)) {
      return DEFAULT_SERIES_BUCKET_COUNT;
    }

    return Math.max(MIN_SERIES_BUCKET_COUNT, Math.min(MAX_SERIES_BUCKET_COUNT, Math.floor(bucketCount)));
  }

  private toMonotonicTimestamp(timestamp: number, previousTimestamp?: number): number {
    const safeTimestamp = Number.isFinite(timestamp) ? Math.floor(timestamp) : Date.now();
    if (!Number.isFinite(previousTimestamp)) {
      return safeTimestamp;
    }

    return Math.max(safeTimestamp, Number(previousTimestamp) + 1);
  }
}
