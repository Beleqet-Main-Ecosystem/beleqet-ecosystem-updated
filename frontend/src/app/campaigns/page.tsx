import { CampaignsDashboard } from '@/components/PromotedEngine/CampaignsDashboard';

/**
 * "My Campaigns" page — employer/freelancer view of every promotion
 * campaign they've started, with live performance stats and pause/
 * resume/cancel controls.
 * Route: /campaigns
 */
export default function CampaignsPage() {
  return (
    <div className="min-h-screen bg-white px-4 py-10">
      <CampaignsDashboard />
    </div>
  );
}