import { prependBoostedIds } from './promotion-merge.util';
import { CampaignAuctionService } from './campaign-auction.service';

/**
 * Integration-style test: auction order must surface at the top of a
 * real search/feed-shaped response (not just isolated rankCampaigns).
 */
describe('promoted items in search/feed responses', () => {
  it('merges auction winners ahead of organic job search results', () => {
    const organicJobs = [
      { id: 'organic-1', title: 'Junior Dev', featured: false },
      { id: 'boosted-job', title: 'Senior React', featured: false },
      { id: 'organic-2', title: 'Designer', featured: true },
    ];

    const auction = new CampaignAuctionService({} as never, {} as never, {} as never);
    const ranked = auction.rankCampaigns(
      [
        {
          id: 'camp-low',
          targetType: 'JOB',
          targetId: 'organic-1',
          bidModel: 'CPC',
          bidAmount: 5,
          createdAt: new Date('2026-01-01'),
          qualityScore: 40,
        },
        {
          id: 'camp-high',
          targetType: 'JOB',
          targetId: 'boosted-job',
          bidModel: 'CPC',
          bidAmount: 50,
          createdAt: new Date('2026-01-02'),
          qualityScore: 80,
        },
      ],
      10,
    );

    const feed = prependBoostedIds(
      organicJobs,
      ranked.map((r) => r.targetId),
      (job) => ({ ...job, promoted: true }),
    );

    expect(feed[0].id).toBe('boosted-job');
    expect(feed[0]).toMatchObject({ promoted: true });
    expect(feed[1].id).toBe('organic-1');
    expect(feed.map((j) => j.id)).toEqual(['boosted-job', 'organic-1', 'organic-2']);
  });
});
