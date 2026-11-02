import FeedClient from './FeedClient';
import FeedHeading from './FeedHeading';

export default function FeedPage() {
  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-5 px-4 pb-14 pt-5 md:px-[clamp(16px,4vw,40px)] md:pb-16 md:pt-8">
      <FeedHeading />
      <FeedClient />
    </div>
  );
}
