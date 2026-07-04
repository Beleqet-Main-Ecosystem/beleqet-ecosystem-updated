import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service'; // ✅ Correct path

@Injectable()
export class AiFeedService {
  constructor(private prisma: PrismaService) {}

  async getPersonalizedFeed(userId: string, limit: number = 5) {
    // 1. Check GDPR
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { gdprConsent: true },
    });

    if (!user?.gdprConsent) {
      return this.prisma.job.findMany({
        where: { status: 'PUBLISHED' },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: { company: true, category: true },
      });
    }

    // 2. Get search history
    const history = await this.prisma.searchHistory.findMany({
      where: { userId, searchedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
    });

    const keywords = this.extractKeywords(history.map(h => h.searchTerm));
    if (keywords.length === 0) {
      return this.prisma.job.findMany({
        where: { status: 'PUBLISHED' },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: { company: true, category: true },
      });
    }

    const jobs = await this.prisma.job.findMany({
      where: { status: 'PUBLISHED' },
      include: { company: true, category: true },
    });

    return jobs
      .map(job => {
        const text = (job.title + ' ' + job.description + ' ' + (job.tags?.join(' ') || '')).toLowerCase();
        const score = keywords.filter(kw => text.includes(kw)).length;
        return { ...job, relevanceScore: Math.min(100, Math.round((score / keywords.length) * 100)) };
      })
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);
  }

  private extractKeywords(terms: string[]): string[] {
    const stopWords = new Set(['the','a','an','and','or','but','for','on','at','to','in','with','without','of','for','by']);
    const words = terms.join(' ').toLowerCase().split(/\s+/);
    return [...new Set(words)].filter(w => w.length > 2 && !stopWords.has(w));
  }
      }
